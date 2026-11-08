// ============================================================
// התראות פוש — הכיס המשפחתי
//
// שני אירועים, שניהם מגיעים רק מהמסד (טריגר / pg_cron) עם הסוד
// x-push-secret:
//   { event: 'tx', rows: [...] }  — תנועות חדשות; כל שאר בני המשפחה
//                                   (לא מי שרשם) עם push_tx מקבלים התראה.
//   { event: 'daily' }            — סיכום של אתמול לכל מי שבחר push_daily.
// השליחה עצמה דרך שירות הפוש של Expo. אסימון שהטלפון ביטל — נמחק.
//
// סודות: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (מוזרקים), PUSH_SECRET.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { asLang, dailyMessage, israelDates, txMessage, type Cat, type Tx } from './messages.ts';

type Msg = { to: string; title: string; body: string; sound: 'default'; data: Record<string, string> };

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return new Response('forbidden', { status: 403 });

  let body: { event?: string; rows?: Tx[] };
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  try {
    if (body.event === 'tx') return Response.json(await onTransactions(body.rows ?? []));
    if (body.event === 'daily') return Response.json(await onDaily());
    return new Response('unknown event', { status: 400 });
  } catch (e) {
    console.error(e);
    return new Response('failed', { status: 500 });
  }
});

/** Tokens of the given users, grouped by user. */
async function tokensFor(userIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!userIds.length) return out;
  const { data, error } = await sb.from('push_tokens').select('token,user_id').in('user_id', userIds);
  if (error) throw error;
  for (const r of data ?? []) out.set(r.user_id, [...(out.get(r.user_id) ?? []), r.token]);
  return out;
}

async function categories(householdIds: string[]): Promise<Map<string, Cat>> {
  const { data } = await sb.from('categories').select('id,name,icon').in('household_id', householdIds);
  return new Map((data ?? []).map((c) => [c.id, c as Cat]));
}

async function onTransactions(rows: Tx[]) {
  if (!rows.length) return { sent: 0 };
  const hids = [...new Set(rows.map((r) => r.household_id))];
  const { data: members, error } = await sb
    .from('household_members')
    .select('household_id,user_id,display_name,push_tx,lang')
    .in('household_id', hids);
  if (error) throw error;
  const cats = await categories(hids);

  const messages: Msg[] = [];
  // one message per (household, author)
  const groups = new Map<string, Tx[]>();
  for (const r of rows) groups.set(`${r.household_id}|${r.created_by}`, [...(groups.get(`${r.household_id}|${r.created_by}`) ?? []), r]);

  const recipients = (members ?? []).filter((m) => m.push_tx);
  const tokens = await tokensFor([...new Set(recipients.map((m) => m.user_id))]);

  for (const [key, txs] of groups) {
    const [hid, author] = key.split('|') as [string, string];
    const authorName = members?.find((m) => m.household_id === hid && m.user_id === author)?.display_name ?? '';
    for (const m of recipients) {
      if (m.household_id !== hid || m.user_id === author) continue;
      const msg = txMessage(txs, authorName, cats, asLang(m.lang));
      if (!msg) continue;
      for (const to of tokens.get(m.user_id) ?? []) messages.push({ to, ...msg, sound: 'default', data: { kind: 'tx' } });
    }
  }
  return { sent: await send(messages) };
}

async function onDaily() {
  const { yesterday, monthStart } = israelDates(new Date());
  const { data: members, error } = await sb
    .from('household_members')
    .select('household_id,user_id,lang')
    .eq('push_daily', true);
  if (error) throw error;
  const tokens = await tokensFor([...new Set((members ?? []).map((m) => m.user_id))]);
  const withPhones = (members ?? []).filter((m) => tokens.has(m.user_id));
  const hids = [...new Set(withPhones.map((m) => m.household_id))];
  if (!hids.length) return { sent: 0 };

  const [{ data: txs, error: e2 }, cats] = await Promise.all([
    sb.from('transactions').select('household_id,kind,amount,category_id,occurred_on,created_by')
      .in('household_id', hids).gte('occurred_on', monthStart).lte('occurred_on', yesterday),
    categories(hids),
  ]);
  if (e2) throw e2;

  const messages: Msg[] = [];
  for (const hid of hids) {
    const mine = (txs ?? []).filter((t) => t.household_id === hid) as Tx[];
    const yest = mine.filter((t) => t.occurred_on === yesterday);
    const monthExp = mine.filter((t) => t.kind === 'expense').reduce((s, t) => s + +t.amount, 0);
    for (const m of withPhones) {
      if (m.household_id !== hid) continue;
      const msg = dailyMessage(yest, cats, monthExp, asLang(m.lang));
      for (const to of tokens.get(m.user_id) ?? []) messages.push({ to, ...msg, sound: 'default', data: { kind: 'daily' } });
    }
  }
  return { sent: await send(messages) };
}

/** Sends through Expo (100 per request) and forgets tokens of phones that uninstalled. */
async function send(messages: Msg[]): Promise<number> {
  let ok = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    const json = await res.json().catch(() => null);
    const tickets: { status: string; details?: { error?: string } }[] = json?.data ?? [];
    const dead: string[] = [];
    tickets.forEach((t, j) => {
      if (t.status === 'ok') ok++;
      else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[j]!.to);
      else console.warn('push ticket', JSON.stringify(t));
    });
    if (dead.length) await sb.from('push_tokens').delete().in('token', dead);
  }
  return ok;
}
