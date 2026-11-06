// ============================================================
// נוסחי ההתראות — טהור, בלי רשת ובלי מסד נתונים, כדי שאפשר לבדוק.
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

export const ils = (n: number) => '₪' + Math.round(Math.abs(n) || 0).toLocaleString('he-IL');

const catLabel = (c?: Cat) => (c ? `${c.icon ? c.icon + ' ' : ''}${c.name}` : '');

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

/** One push for one save: a single transaction, or a short summary of several. */
export function txMessage(rows: Tx[], authorName: string, cats: Map<string, Cat>): { title: string; body: string } | null {
  const real = rows.filter((r) => r.kind === 'expense' || r.kind === 'income');
  if (!real.length) return null;
  const who = authorName.trim() || 'בן משפחה';

  if (real.length === 1) {
    const t = real[0]!;
    const cat = catLabel(t.category_id ? cats.get(t.category_id) : undefined);
    const parts = [ils(+t.amount)];
    if (cat) parts.push(cat);
    if (t.note && t.note.trim()) parts.push(clip(t.note.trim(), 40));
    return {
      title: t.kind === 'income' ? '💰 הכנסה חדשה' : '💸 הוצאה חדשה',
      body: `${who}: ${parts.join(' · ')}`,
    };
  }

  const exp = real.filter((r) => r.kind === 'expense').reduce((s, r) => s + +r.amount, 0);
  const inc = real.filter((r) => r.kind === 'income').reduce((s, r) => s + +r.amount, 0);
  const parts = [`${real.length} תנועות חדשות`];
  if (exp) parts.push(`הוצאות ${ils(exp)}`);
  if (inc) parts.push(`הכנסות ${ils(inc)}`);
  return { title: '📒 תנועות חדשות', body: `${who}: ${parts.join(' · ')}` };
}

/** Yesterday's summary for one household. */
export function dailyMessage(yesterday: Tx[], cats: Map<string, Cat>, monthExpenses: number): { title: string; body: string } {
  const exp = yesterday.filter((r) => r.kind === 'expense');
  const inc = yesterday.filter((r) => r.kind === 'income');
  const title = '☀️ הסיכום של אתמול';

  if (!exp.length && !inc.length) {
    return { title, body: 'אתמול לא נרשמו תנועות. היו הוצאות? זה זמן טוב לרשום אותן ✍️' };
  }

  const sum = (a: Tx[]) => a.reduce((s, r) => s + +r.amount, 0);
  const parts: string[] = [];
  if (exp.length) parts.push(`הוצאות ${ils(sum(exp))} (${exp.length === 1 ? 'תנועה אחת' : exp.length + ' תנועות'})`);
  if (inc.length) parts.push(`הכנסות ${ils(sum(inc))}`);

  // the category where most of yesterday's money went
  const byCat = new Map<string, number>();
  for (const r of exp) if (r.category_id) byCat.set(r.category_id, (byCat.get(r.category_id) ?? 0) + +r.amount);
  let top: [string, number] | null = null;
  for (const e of byCat) if (!top || e[1] > top[1]) top = e;
  if (top && exp.length > 1 && cats.get(top[0])) parts.push(`הכי הרבה: ${catLabel(cats.get(top[0]))} ${ils(top[1])}`);

  if (monthExpenses > 0) parts.push(`מתחילת החודש: ${ils(monthExpenses)}`);
  return { title, body: parts.join(' · ') };
}

/** Pure: "yesterday" and "start of this month" as dates in Israel, whatever the server clock. */
export function israelDates(now: Date): { yesterday: string; monthStart: string } {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const y = fmt(new Date(now.getTime() - 864e5));
  // the month the summary is about is yesterday's month, so on the 1st it closes last month
  return { yesterday: y, monthStart: y.slice(0, 8) + '01' };
}
