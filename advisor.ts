// ============================================================
// יועץ הכיס — ניתוח הנתונים של המשפחה בעזרת Claude
//
// עיקרון מנחה: הפונקציה עובדת עם ה-JWT של המשתמש שקרא לה, ולא עם
// מפתח שירות. המשמעות היא ש-RLS חל כרגיל, והפונקציה *לא מסוגלת*
// לקרוא נתונים של משפחה אחרת גם אם יש באג — ההגבלה בשרת, לא בקוד.
//
// סוד יחיד שצריך להגדיר ידנית (Edge Functions → Secrets):
//   ANTHROPIC_API_KEY
// אופציונלי: ANTHROPIC_MODEL (אם רוצים לקבע דגם מסוים)
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_PER_DAY = 3;
const MAX_PER_MONTH = 30;
const TX_DAYS = 120;      /* כמה אחורה לשלוח תנועות מפורטות */
const TX_CAP = 500;       /* תקרה, כדי שהעלות לא תרוץ עם הוותק */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

/* אני לא רוצה לקבע מזהה דגם שעלול להשתנות מתחתיי, ולהשאיר את
   הפיצ'ר שבור בלי שאף אחד ישים לב. לכן: מנסים את המבוקש, ואם הוא
   לא קיים — שואלים את ה-API מה כן קיים ובוחרים את הסונט העדכני. */
let cachedModel: string | null = null;
async function pickModel(key: string, want: string): Promise<string> {
  if (cachedModel) return cachedModel;
  try {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (!r.ok) return (cachedModel = want);
    const list = (await r.json()).data as { id: string }[];
    const ids = list.map((m) => m.id);
    if (ids.includes(want)) return (cachedModel = want);
    const sonnet = ids.filter((id) => id.includes('sonnet')).sort().pop();
    return (cachedModel = sonnet || ids[0] || want);
  } catch {
    return (cachedModel = want);
  }
}

const SYSTEM = `אתה "יועץ הכיס" — עוזר שקורא נתוני תקציב של משפחה אחת ומנסה
לעזור לה. אתה כותב בעברית, בגוף שני רבים, בטון ענייני וחברי. לא מתלהב,
לא מטיף, לא משתמש בסימני קריאה.

הכללים, לפי סדר חשיבות:

1. **כל ממצא חייב להיות מעוגן במספר שקיבלת.** אל תמציא מספרים, אל
   תעגל בגסות, ואל תסיק מגמה משני חודשים. אם הנתונים לא מספיקים
   לממצא — אל תכתוב אותו. עדיף ארבעה ממצאים אמיתיים משמונה רדודים.

2. **אתה לא יועץ פיננסי, ואסור לך להתנהג כמו אחד.** אל תמליץ על
   השקעות, על מוצרים פיננסיים, על נטילת הלוואה או מיחזור משכנתא,
   ואל תנקוב בשם של חברת ביטוח, בנק, קרן או סוכן. מותר לך לומר
   "שווה לבדוק אם אפשר להוזיל את X" — אסור לך לומר "עברו ל-Y".

3. **הפרדה מוחלטת בין שני חלקי התשובה.** findings הם דברים שראית
   בנתונים. income_ideas הם רעיונות כלליים שאינם נובעים מהנתונים
   ואינם מותאמים אישית — אתה לא יודע במה הם עוסקים, מה הכישורים
   שלהם או מה השוק משלם. אל תתחזה לדעת.

4. **תעדף לפי כסף.** ממצא ששווה 400 ש"ח בחודש קודם לממצא ששווה 30.
   הוצאות קבועות הן בדרך כלל המקום עם ההחזר הגבוה ביותר על המאמץ,
   כי הן חוזרות כל חודש בלי החלטה מחודשת.

5. **אל תשפוט את אורח החיים.** "יצאתם 14 פעם למסעדה" הוא ממצא;
   "אתם מבזבזים על מסעדות" הוא שיפוט. אתה מתאר, הם מחליטים.

6. אם משהו בנתונים נראה כמו טעות רישום (סכום חריג פי כמה, קטגוריה
   שלא הגיונית) — ציין את זה כממצא. שווה יותר מעצה.

החזר JSON בלבד, בלי טקסט לפניו או אחריו, במבנה:
{
  "headline": "משפט אחד שמסכם את התמונה. עובדתי.",
  "findings": [
    {
      "icon": "אימוג'י אחד",
      "title": "כותרת קצרה",
      "evidence": "המספרים שעליהם הממצא נשען, כלשונם",
      "detail": "מה זה אומר, במשפט או שניים",
      "action": "מה אפשר לעשות עם זה. אם אין פעולה ברורה — השאר ריק",
      "monthly": מספר או null — כמה שקלים בחודש עומדים על הפרק
    }
  ],
  "income_ideas": [
    { "title": "כותרת", "detail": "משפט או שניים. כללי, לא מותאם אישית." }
  ]
}

findings: בין 3 ל-6. income_ideas: בין 2 ל-4, ורק כאלה שרלוונטיים
למשק בית ולא דורשים הון התחלתי.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'not_configured' }, 503);

  /* הלקוח נוצר עם הטוקן של המשתמש — משם RLS עושה את שלו */
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );

  const { data: ures } = await sb.auth.getUser();
  const user = ures?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const hid = String(body.household_id || '');
  if (!hid) return json({ error: 'missing household' }, 400);

  /* חברות ההסכמה נבדקות מול השרת ולא נסמכות על הלקוח */
  const { data: house, error: he } = await sb
    .from('households').select('id, ai_consent').eq('id', hid).maybeSingle();
  if (he || !house) return json({ error: 'forbidden' }, 403);
  if (!house.ai_consent) return json({ error: 'no_consent' }, 403);

  /* תקרת שימוש */
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ count: dayN }, { count: monN }] = await Promise.all([
    sb.from('advisor_runs').select('id', { count: 'exact', head: true })
      .eq('household_id', hid).gte('created_at', dayAgo),
    sb.from('advisor_runs').select('id', { count: 'exact', head: true })
      .eq('household_id', hid).gte('created_at', monthAgo),
  ]);
  if ((dayN ?? 0) >= MAX_PER_DAY)
    return json({ error: 'rate_day', max: MAX_PER_DAY }, 429);
  if ((monN ?? 0) >= MAX_PER_MONTH)
    return json({ error: 'rate_month', max: MAX_PER_MONTH }, 429);

  /* ---------- איסוף הנתונים ---------- */
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const since = iso(new Date(today.getTime() - 400 * 864e5));
  const txSince = iso(new Date(today.getTime() - TX_DAYS * 864e5));
  const month = iso(today).slice(0, 7);

  const [{ data: cats }, { data: txs }, { data: recs }, { data: mems },
         { data: goals }, { data: deps }] = await Promise.all([
    sb.from('categories').select('id,name,icon,kind,budget,budget_history,freq')
      .eq('household_id', hid).eq('archived', false),
    sb.from('transactions')
      .select('kind,amount,occurred_on,category_id,member_id,member_label,note,is_fixed')
      .eq('household_id', hid).gte('occurred_on', since)
      .order('occurred_on', { ascending: false }),
    sb.from('recurring').select('name,amount,category_id,day_of_month,active')
      .eq('household_id', hid),
    sb.from('household_members').select('user_id,display_name').eq('household_id', hid),
    /* יעדים משפחתיים בלבד — יעד אישי לא יוצא מהמערכת, נקודה */
    sb.from('goals').select('id,name,target_amount,target_date')
      .eq('household_id', hid).is('owner_id', null).eq('archived', false),
    sb.from('goal_deposits').select('goal_id,amount').eq('household_id', hid),
  ]);

  const catById: Record<string, any> = {};
  (cats || []).forEach((c) => (catById[c.id] = c));
  const memName: Record<string, string> = {};
  (mems || []).forEach((m) => (memName[m.user_id] = m.display_name));

  const budgetAt = (c: any, m: string) => {
    const h = c?.budget_history;
    if (h && typeof h === 'object') {
      let best: string | null = null;
      for (const k of Object.keys(h)) if (k <= m && (best === null || k > best)) best = k;
      if (best !== null) return +h[best] || 0;
    }
    return +(c?.budget) || 0;
  };

  /* סיכומים חודשיים */
  const byMonth: Record<string, { income: number; expense: number }> = {};
  const catMonth: Record<string, Record<string, number>> = {};
  (txs || []).forEach((t) => {
    const m = t.occurred_on.slice(0, 7);
    byMonth[m] = byMonth[m] || { income: 0, expense: 0 };
    if (t.kind === 'income') byMonth[m].income += +t.amount;
    else {
      byMonth[m].expense += +t.amount;
      const c = catById[t.category_id];
      const name = c ? c.name : 'ללא קטגוריה';
      catMonth[name] = catMonth[name] || {};
      catMonth[name][m] = (catMonth[name][m] || 0) + +t.amount;
    }
  });

  const goalSaved: Record<string, number> = {};
  (deps || []).forEach((d) => (goalSaved[d.goal_id] = (goalSaved[d.goal_id] || 0) + +d.amount));

  const detailed = (txs || [])
    .filter((t) => t.occurred_on >= txSince)
    .slice(0, TX_CAP)
    .map((t) => ({
      d: t.occurred_on,
      a: +t.amount,
      k: t.kind === 'income' ? 'in' : 'out',
      c: catById[t.category_id]?.name || '',
      w: t.member_id ? (memName[t.member_id] || '') : (t.member_label || ''),
      n: t.note || '',
      f: t.is_fixed || undefined,
    }));

  const payload = {
    today: iso(today),
    current_month: month,
    day_of_month: today.getDate(),
    days_in_month: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
    members: (mems || []).map((m) => m.display_name),
    monthly_totals: Object.entries(byMonth).sort()
      .map(([m, v]) => ({ month: m, income: Math.round(v.income), expense: Math.round(v.expense) })),
    categories: (cats || []).filter((c) => c.kind === 'expense').map((c) => ({
      name: c.name,
      budget_now: budgetAt(c, month),
      every_n_months: +c.freq || 1,
      spent_by_month: catMonth[c.name] || {},
    })),
    income_sources: (cats || []).filter((c) => c.kind === 'income').map((c) => c.name),
    recurring: (recs || []).filter((r) => r.active !== false).map((r) => ({
      name: r.name, amount: +r.amount,
      category: catById[r.category_id]?.name || '', day: r.day_of_month,
    })),
    family_goals: (goals || []).map((g) => ({
      name: g.name, target: +g.target_amount,
      saved: Math.round(goalSaved[g.id] || 0), by: g.target_date || null,
    })),
    recent_transactions: detailed,
    notes_for_you: [
      `רשימת התנועות המפורטת מכסה ${TX_DAYS} ימים אחרונים ומוגבלת ל-${TX_CAP} רשומות.`,
      'סיכומים חודשיים מכסים טווח ארוך יותר וגוברים על ספירה ידנית של הרשימה.',
      'יעדי חיסכון אישיים אינם כלולים כאן במכוון.',
    ],
  };

  /* ---------- קריאה ל-Claude ---------- */
  const model = await pickModel(key, Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-5');
  let out: any = null, failNote = '';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: 'הנה הנתונים של המשפחה. נתח והחזר JSON בלבד.\n\n'
                 + JSON.stringify(payload),
        }],
      }),
    });
    if (!r.ok) {
      failNote = 'anthropic ' + r.status;
      const detail = await r.text();
      await sb.from('advisor_runs').insert(
        { household_id: hid, created_by: user.id, ok: false, note: failNote });
      return json({ error: 'upstream', status: r.status, detail: detail.slice(0, 300) }, 502);
    }
    const data = await r.json();
    const text = (data.content || []).map((c: any) => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    out = JSON.parse(m ? m[0] : text);
  } catch (e) {
    failNote = String(e).slice(0, 200);
    await sb.from('advisor_runs').insert(
      { household_id: hid, created_by: user.id, ok: false, note: failNote });
    return json({ error: 'parse', detail: failNote }, 502);
  }

  await sb.from('advisor_runs').insert(
    { household_id: hid, created_by: user.id, ok: true, note: model });

  return json({
    headline: String(out.headline || ''),
    findings: Array.isArray(out.findings) ? out.findings.slice(0, 8) : [],
    income_ideas: Array.isArray(out.income_ideas) ? out.income_ideas.slice(0, 5) : [],
    model,
    used_today: (dayN ?? 0) + 1,
    max_per_day: MAX_PER_DAY,
  });
});
