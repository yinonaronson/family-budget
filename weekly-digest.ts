// ============================================================
// סיכום שבועי במייל — הכיס המשפחתי
//
// רץ פעם בשבוע (pg_cron קורא לפונקציה הזו), ושולח לכל מי שביקש
// לקבל סיכום. אף אחד לא נרשם אוטומטית: weekly_digest ברירת המחדל
// שלו false, וההצטרפות היא מתוך ההגדרות באפליקציה.
//
// סודות שהפונקציה צריכה (מוגדרים ב-Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — מוזרקים אוטומטית
//   RESEND_API_KEY                            — צריך להוסיף ידנית
//   DIGEST_CRON_SECRET                        — צריך להוסיף ידנית
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי',
                'אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const SITE = 'https://thefamilypocket.com';
const FROM = 'הכיס המשפחתי <noreply@thefamilypocket.com>';

const ils = (n: number) =>
  '₪' + Math.round(n || 0).toLocaleString('he-IL');
const monthLabel = (m: string) => MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/* התקציב של חודש נתון — אותה לוגיקה בדיוק כמו באפליקציה.
   מפה דלילה של חודש -> סכום; לוקחים את המפתח הגדול ביותר שאינו
   גדול מהחודש המבוקש. */
function budgetAt(cat: any, m: string): number {
  const h = cat.budget_history;
  if (h && typeof h === 'object') {
    let best: string | null = null;
    for (const k of Object.keys(h)) if (k <= m && (best === null || k > best)) best = k;
    if (best !== null) return +h[best] || 0;
  }
  return +cat.budget || 0;
}

Deno.serve(async (req) => {
  /* רק ה-cron שלנו מורשה להפעיל. בלי זה כל אחד באינטרנט היה יכול
     לגרום למערכת לשלוח דואר בשמכם. */
  const secret = Deno.env.get('DIGEST_CRON_SECRET');
  if (!secret || req.headers.get('x-digest-secret') !== secret)
    return new Response('forbidden', { status: 403 });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return new Response('missing RESEND_API_KEY', { status: 500 });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const weekAgo = new Date(today.getTime() - 7 * 864e5);
  const from = iso(weekAgo), to = iso(today);
  const month = to.slice(0, 7);

  /* מי ביקש לקבל */
  const { data: subs, error: e1 } = await sb
    .from('household_members')
    .select('user_id, household_id, display_name, digest_token')
    .eq('weekly_digest', true);
  if (e1) return new Response('query failed: ' + e1.message, { status: 500 });
  if (!subs?.length) return Response.json({ sent: 0, note: 'no subscribers' });

  const hids = [...new Set(subs.map((s) => s.household_id))];

  const [{ data: txs }, { data: cats }, { data: goals }, { data: deps }, { data: houses }] =
    await Promise.all([
      sb.from('transactions').select('household_id,kind,amount,occurred_on,category_id')
        .in('household_id', hids).gte('occurred_on', month + '-01'),
      sb.from('categories').select('id,household_id,name,icon,budget,budget_history,freq,archived')
        .in('household_id', hids).eq('archived', false).eq('kind', 'expense'),
      /* יעדים משפחתיים בלבד. יעד אישי שייך לאדם אחד, וגם בתוך המשפחה
         אף אחד אחר לא אמור לראות אותו — בוודאי לא במייל. */
      sb.from('goals').select('id,household_id,name,icon,target_amount')
        .in('household_id', hids).is('owner_id', null).eq('archived', false),
      sb.from('goal_deposits').select('goal_id,household_id,amount').in('household_id', hids),
      sb.from('households').select('id,name').in('id', hids),
    ]);

  const results: any[] = [];

  for (const sub of subs) {
    const hid = sub.household_id;
    const house = (houses || []).find((h) => h.id === hid);
    const myCats = (cats || []).filter((c) => c.household_id === hid);
    const myTx = (txs || []).filter((t) => t.household_id === hid);

    const week = myTx.filter((t) => t.occurred_on >= from && t.occurred_on <= to);
    const weekExp = week.filter((t) => t.kind === 'expense')
      .reduce((a, t) => a + +t.amount, 0);
    const monthExp = myTx.filter((t) => t.kind === 'expense')
      .reduce((a, t) => a + +t.amount, 0);
    const monthInc = myTx.filter((t) => t.kind === 'income')
      .reduce((a, t) => a + +t.amount, 0);

    /* אין מה לדווח? לא שולחים. מייל ריק שבועי הוא הדרך הכי מהירה
       לגרום למישהו להסיר את עצמו. */
    if (!week.length) { results.push({ to: sub.user_id, skipped: 'no activity' }); continue; }

    const budgetTotal = myCats.reduce(
      (a, c) => a + budgetAt(c, month) / Math.max(1, +c.freq || 1), 0);

    const byCat: Record<string, number> = {};
    week.filter((t) => t.kind === 'expense')
      .forEach((t) => { byCat[t.category_id] = (byCat[t.category_id] || 0) + +t.amount });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, v]) => ({ cat: myCats.find((c) => c.id === id), v }))
      .filter((x) => x.cat);

    /* חריגות בחודש הנוכחי */
    const spentMonth: Record<string, number> = {};
    myTx.filter((t) => t.kind === 'expense')
      .forEach((t) => { spentMonth[t.category_id] = (spentMonth[t.category_id] || 0) + +t.amount });
    const over = myCats
      .map((c) => ({ c, b: budgetAt(c, month), sp: spentMonth[c.id] || 0 }))
      .filter((x) => x.b > 0 && x.sp > x.b)
      .sort((a, b) => (b.sp - b.b) - (a.sp - a.b)).slice(0, 4);

    /* קצב: איפה אנחנו מול הצפי לחודש */
    const day = today.getDate();
    const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const expected = budgetTotal * (day / dim);
    const delta = budgetTotal ? (monthExp - expected) / budgetTotal * 100 : 0;

    const myGoals = (goals || []).filter((g) => g.household_id === hid).map((g) => ({
      ...g,
      saved: (deps || []).filter((d) => d.goal_id === g.id).reduce((a, d) => a + +d.amount, 0),
    })).slice(0, 3);

    /* כתובת המייל של המשתמש */
    const { data: u } = await sb.auth.admin.getUserById(sub.user_id);
    const email = u?.user?.email;
    if (!email) { results.push({ to: sub.user_id, skipped: 'no email' }); continue; }

    const html = render({
      name: sub.display_name || 'שלום',
      house: house?.name || 'המשפחה שלי',
      from, to, month, weekExp, monthExp, monthInc, budgetTotal,
      delta, day, dim, top, over, goals: myGoals,
      unsub: `${SITE}/#unsub=${sub.digest_token}`,
    });

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + resendKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: `סיכום השבוע · הוצאתם ${ils(weekExp)}`,
        html,
        headers: { 'List-Unsubscribe': `<${SITE}/#unsub=${sub.digest_token}>` },
      }),
    });
    results.push({ to: email, ok: r.ok, status: r.status });
  }

  return Response.json({ sent: results.filter((r) => r.ok).length, results });
});

function render(d: any): string {
  const good = d.delta <= 2, warn = d.delta > 2 && d.delta <= 10;
  const paceColor = good ? '#1a7f5a' : warn ? '#b26a00' : '#c0392b';
  const paceText = good
    ? `אתם בקצב טוב — עברו ${Math.round(d.day / d.dim * 100)}% מהחודש`
    : `${Math.abs(Math.round(d.delta))}% ${d.delta > 0 ? 'מעל הקצב' : 'מתחת לקצב'} — ביום ${d.day} מתוך ${d.dim}`;

  const row = (label: string, val: string, color = '#111827') => `
    <tr>
      <td style="padding:9px 0;color:#6b7280;font-size:14px">${esc(label)}</td>
      <td style="padding:9px 0;text-align:left;font-weight:700;font-size:15px;color:${color}">${val}</td>
    </tr>`;

  return `<!doctype html>
<html dir="rtl" lang="he"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;
  font-family:'Segoe UI',Arial,Helvetica,sans-serif;direction:rtl">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:22px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;
         box-shadow:0 1px 3px rgba(0,0,0,.08)">

  <tr><td style="background:#2a78d6;padding:22px 26px;color:#fff">
    <div style="font-size:13px;opacity:.85">${esc(d.house)}</div>
    <div style="font-size:21px;font-weight:800;margin-top:2px">סיכום השבוע</div>
    <div style="font-size:13px;opacity:.85;margin-top:4px">
      שבעת הימים שהסתיימו ב-<span dir="ltr">${d.to.slice(8, 10)}.${d.to.slice(5, 7)}.${d.to.slice(0, 4)}</span></div>
  </td></tr>

  <tr><td style="padding:24px 26px 6px">
    <div style="font-size:15px;color:#374151">${esc(d.name)}, השבוע הוצאתם</div>
    <div style="font-size:34px;font-weight:800;color:#111827;margin:6px 0 2px">${ils(d.weekExp)}</div>
    <div style="display:inline-block;font-size:13px;font-weight:700;color:${paceColor};
      background:${paceColor}14;border-radius:999px;padding:6px 12px;margin-top:8px">
      ${esc(paceText)}</div>
  </td></tr>

  <tr><td style="padding:14px 26px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="border-top:1px solid #e5e7eb">
      ${row(`הוצאות ${monthLabel(d.month)}`, ils(d.monthExp))}
      ${row('הכנסות החודש', ils(d.monthInc))}
      ${row('תקציב חודשי', ils(d.budgetTotal))}
      ${row(d.monthInc - d.monthExp >= 0 ? 'עודף החודש' : 'גירעון החודש',
            ils(Math.abs(d.monthInc - d.monthExp)),
            d.monthInc - d.monthExp >= 0 ? '#1a7f5a' : '#c0392b')}
    </table>
  </td></tr>

  ${d.top.length ? `
  <tr><td style="padding:20px 26px 0">
    <div style="font-size:15px;font-weight:800;color:#111827;margin-bottom:10px">לאן הלך הכסף השבוע</div>
    ${d.top.map((t: any) => `
      <div style="display:block;padding:9px 0;border-bottom:1px solid #f3f4f6">
        <span style="font-size:17px">${esc(t.cat.icon)}</span>
        <span style="font-size:14px;color:#374151;margin-right:6px">${esc(t.cat.name)}</span>
        <span style="float:left;font-size:14px;font-weight:700;color:#111827">${ils(t.v)}</span>
      </div>`).join('')}
  </td></tr>` : ''}

  ${d.over.length ? `
  <tr><td style="padding:20px 26px 0">
    <div style="font-size:15px;font-weight:800;color:#c0392b;margin-bottom:10px">⛔ חריגות החודש</div>
    ${d.over.map((o: any) => `
      <div style="padding:9px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151">
        <span style="font-size:16px">${esc(o.c.icon)}</span>
        <span style="margin-right:6px">${esc(o.c.name)}</span>
        <span style="float:left;font-weight:700;color:#c0392b">
          ${ils(o.sp - o.b)} מעל ${ils(o.b)}</span>
      </div>`).join('')}
  </td></tr>` : ''}

  ${d.goals.length ? `
  <tr><td style="padding:20px 26px 0">
    <div style="font-size:15px;font-weight:800;color:#111827;margin-bottom:10px">יעדי החיסכון המשפחתיים</div>
    ${d.goals.map((g: any) => {
      const pct = g.target_amount ? Math.min(100, g.saved / g.target_amount * 100) : 0;
      return `
      <div style="padding:9px 0">
        <div style="font-size:14px;color:#374151">
          <span style="font-size:16px">${esc(g.icon)}</span>
          <span style="margin-right:6px">${esc(g.name)}</span>
          <span style="float:left;font-weight:700">${ils(g.saved)} / ${ils(g.target_amount)}</span>
        </div>
        <div style="background:#e5e7eb;border-radius:999px;height:7px;margin-top:7px">
          <div style="background:#2a78d6;height:7px;border-radius:999px;width:${pct.toFixed(0)}%"></div>
        </div>
      </div>`}).join('')}
  </td></tr>` : ''}

  <tr><td style="padding:24px 26px">
    <a href="${SITE}" style="display:block;background:#2a78d6;color:#fff;text-decoration:none;
      text-align:center;padding:13px;border-radius:11px;font-weight:700;font-size:15px">
      פתיחת הכיס המשפחתי</a>
  </td></tr>

  <tr><td style="padding:4px 26px 24px;text-align:center;color:#9ca3af;font-size:12px;line-height:1.7">
    המייל הזה נשלח אליכם כי ביקשתם לקבל סיכום שבועי.<br>
    <a href="${d.unsub}" style="color:#6b7280">להפסיק לקבל את הסיכום</a>
  </td></tr>

</table></td></tr></table></body></html>`;
}
