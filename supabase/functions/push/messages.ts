// ============================================================
// נוסחי ההתראות — טהור, בלי רשת ובלי מסד נתונים, כדי שאפשר לבדוק.
// כל נוסח בשלוש שפות: he (ברירת מחדל), en, ar — לפי השפה שבן המשפחה בחר.
// ============================================================

export type Tx = {
  household_id: string;
  kind: 'expense' | 'income' | 'transfer';
  amount: number | string;
  category_id?: string | null;
  note?: string | null;
  created_by: string;
  occurred_on?: string;
};

export type Cat = { id: string; name: string; icon?: string | null };

export type Lang = 'he' | 'en' | 'ar';

export const asLang = (l: unknown): Lang => (l === 'en' || l === 'ar' ? l : 'he');

type Strings = {
  someone: string;
  newExpense: string;
  newIncome: string;
  newMany: string;
  nTx: (n: number) => string;
  expenses: (s: string) => string;
  incomes: (s: string) => string;
  dailyTitle: string;
  quietDay: string;
  oneTx: string;
  most: (s: string) => string;
  monthSoFar: (s: string) => string;
};

const S: Record<Lang, Strings> = {
  he: {
    someone: 'בן משפחה',
    newExpense: '💸 הוצאה חדשה',
    newIncome: '💰 הכנסה חדשה',
    newMany: '📒 תנועות חדשות',
    nTx: (n) => `${n} תנועות`,
    expenses: (s) => `הוצאות ${s}`,
    incomes: (s) => `הכנסות ${s}`,
    dailyTitle: '☀️ הסיכום של אתמול',
    quietDay: 'אתמול לא נרשמו תנועות. היו הוצאות? זה זמן טוב לרשום אותן ✍️',
    oneTx: 'תנועה אחת',
    most: (s) => `הכי הרבה: ${s}`,
    monthSoFar: (s) => `מתחילת החודש: ${s}`,
  },
  en: {
    someone: 'Family member',
    newExpense: '💸 New expense',
    newIncome: '💰 New income',
    newMany: '📒 New transactions',
    nTx: (n) => `${n} transactions`,
    expenses: (s) => `expenses ${s}`,
    incomes: (s) => `income ${s}`,
    dailyTitle: "☀️ Yesterday's summary",
    quietDay: 'No transactions were recorded yesterday. Any expenses? Now is a good time to log them ✍️',
    oneTx: '1 transaction',
    most: (s) => `most: ${s}`,
    monthSoFar: (s) => `month so far: ${s}`,
  },
  ar: {
    someone: 'فرد من العائلة',
    newExpense: '💸 مصروف جديد',
    newIncome: '💰 دخل جديد',
    newMany: '📒 حركات جديدة',
    nTx: (n) => `${n} حركات`,
    expenses: (s) => `مصاريف ${s}`,
    incomes: (s) => `مداخيل ${s}`,
    dailyTitle: '☀️ ملخص الأمس',
    quietDay: 'لم تُسجَّل أي حركات أمس. هل كانت هناك مصاريف؟ هذا وقت مناسب لتسجيلها ✍️',
    oneTx: 'حركة واحدة',
    most: (s) => `الأكثر: ${s}`,
    monthSoFar: (s) => `منذ بداية الشهر: ${s}`,
  },
};

/** שמות ברירת המחדל של הקטגוריות — משפחה ותיקה שומרת אותם בעברית, והם מתורגמים בהתראה. */
const CAT_NAMES: Record<'en' | 'ar', Record<string, string>> = {
  en: {
    'משכנתא / שכר דירה': 'Mortgage / rent', 'סופר ומזון': 'Groceries & food', 'דלק ותחבורה': 'Fuel & transport',
    'חינוך וחוגים': 'Education & activities', 'בילויים ומסעדות': 'Outings & restaurants', 'חשמל': 'Electricity',
    'מים': 'Water', 'גז': 'Gas', 'ארנונה': 'Arnona', 'ביטוחים': 'Insurance', 'תקשורת': 'Phone & internet',
    'בריאות ותרופות': 'Health & medicine', 'ביגוד והנעלה': 'Clothing & footwear', 'חיסכון והשקעות': 'Savings & investments',
    'שונות': 'Miscellaneous', 'משכורת': 'Salary', 'קצבאות': 'Allowances', 'הכנסה נוספת': 'Additional income',
    'חיסכון': 'Savings', 'מניות והשקעות': 'Stocks & investments',
  },
  ar: {
    'משכנתא / שכר דירה': 'قرض سكني / إيجار', 'סופר ומזון': 'سوبرماركت وطعام', 'דלק ותחבורה': 'وقود ومواصلات',
    'חינוך וחוגים': 'تعليم وأنشطة', 'בילויים ומסעדות': 'ترفيه ومطاعم', 'חשמל': 'كهرباء', 'מים': 'مياه', 'גז': 'غاز',
    'ארנונה': 'الأرنونا', 'ביטוחים': 'تأمينات', 'תקשורת': 'اتصالات', 'בריאות ותרופות': 'صحة وأدوية',
    'ביגוד והנעלה': 'ملابس وأحذية', 'חיסכון והשקעות': 'ادخار واستثمارات', 'שונות': 'متفرقات', 'משכורת': 'راتب',
    'קצבאות': 'مخصصات', 'הכנסה נוספת': 'دخل إضافي', 'חיסכון': 'ادخار', 'מניות והשקעות': 'أسهم واستثمارات',
  },
};

export const ils = (n: number) => '₪' + Math.round(Math.abs(n) || 0).toLocaleString('he-IL');

const catLabel = (c: Cat | undefined, lang: Lang) => {
  if (!c) return '';
  const name = lang === 'he' ? c.name : CAT_NAMES[lang][c.name.trim()] ?? c.name;
  return `${c.icon ? c.icon + ' ' : ''}${name}`;
};

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

/** One push for one save: a single transaction, or a short summary of several. */
export function txMessage(
  rows: Tx[],
  authorName: string,
  cats: Map<string, Cat>,
  lang: Lang = 'he',
): { title: string; body: string } | null {
  const L = S[lang];
  const real = rows.filter((r) => r.kind === 'expense' || r.kind === 'income');
  if (!real.length) return null;
  const who = authorName.trim() || L.someone;

  if (real.length === 1) {
    const t = real[0]!;
    const cat = catLabel(t.category_id ? cats.get(t.category_id) : undefined, lang);
    const parts = [ils(+t.amount)];
    if (cat) parts.push(cat);
    if (t.note && t.note.trim()) parts.push(clip(t.note.trim(), 40));
    return {
      title: t.kind === 'income' ? L.newIncome : L.newExpense,
      body: `${who}: ${parts.join(' · ')}`,
    };
  }

  const exp = real.filter((r) => r.kind === 'expense').reduce((s, r) => s + +r.amount, 0);
  const inc = real.filter((r) => r.kind === 'income').reduce((s, r) => s + +r.amount, 0);
  const parts = [lang === 'he' ? `${real.length} תנועות חדשות` : L.nTx(real.length)];
  if (exp) parts.push(L.expenses(ils(exp)));
  if (inc) parts.push(L.incomes(ils(inc)));
  return { title: L.newMany, body: `${who}: ${parts.join(' · ')}` };
}

/** Yesterday's summary for one household. */
export function dailyMessage(
  yesterday: Tx[],
  cats: Map<string, Cat>,
  monthExpenses: number,
  lang: Lang = 'he',
): { title: string; body: string } {
  const L = S[lang];
  const exp = yesterday.filter((r) => r.kind === 'expense');
  const inc = yesterday.filter((r) => r.kind === 'income');
  const title = L.dailyTitle;

  if (!exp.length && !inc.length) return { title, body: L.quietDay };

  const sum = (a: Tx[]) => a.reduce((s, r) => s + +r.amount, 0);
  const parts: string[] = [];
  if (exp.length) parts.push(`${L.expenses(ils(sum(exp)))} (${exp.length === 1 ? L.oneTx : L.nTx(exp.length)})`);
  if (inc.length) parts.push(L.incomes(ils(sum(inc))));

  // the category where most of yesterday's money went
  const byCat = new Map<string, number>();
  for (const r of exp) if (r.category_id) byCat.set(r.category_id, (byCat.get(r.category_id) ?? 0) + +r.amount);
  let top: [string, number] | null = null;
  for (const e of byCat) if (!top || e[1] > top[1]) top = e;
  if (top && exp.length > 1 && cats.get(top[0])) parts.push(L.most(`${catLabel(cats.get(top[0]), lang)} ${ils(top[1])}`));

  if (monthExpenses > 0) parts.push(L.monthSoFar(ils(monthExpenses)));
  const body = parts.join(' · ');
  // English sentence starts with a capital letter
  return { title, body: lang === 'en' ? body.charAt(0).toUpperCase() + body.slice(1) : body };
}

/** Pure: "yesterday" and "start of this month" as dates in Israel, whatever the server clock. */
export function israelDates(now: Date): { yesterday: string; monthStart: string } {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const y = fmt(new Date(now.getTime() - 864e5));
  // the month the summary is about is yesterday's month, so on the 1st it closes last month
  return { yesterday: y, monthStart: y.slice(0, 8) + '01' };
}
