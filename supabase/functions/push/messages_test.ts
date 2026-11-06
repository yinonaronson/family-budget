const assertEquals = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
};

import { dailyMessage, israelDates, txMessage, type Cat, type Tx } from './messages.ts';

const cats = new Map<string, Cat>([
  ['c1', { id: 'c1', name: 'סופר', icon: '🛒' }],
  ['c2', { id: 'c2', name: 'דלק', icon: '⛽' }],
]);
const tx = (p: Partial<Tx>): Tx => ({ household_id: 'h', kind: 'expense', amount: 100, created_by: 'u', ...p });

Deno.test('one expense names who, how much and where', () => {
  assertEquals(txMessage([tx({ amount: '120.5', category_id: 'c1', note: 'קניות שבת' })], 'דנה', cats), {
    title: '💸 הוצאה חדשה',
    body: 'דנה: ₪121 · 🛒 סופר · קניות שבת',
  });
});

Deno.test('one income', () => {
  assertEquals(txMessage([tx({ kind: 'income', amount: 9000 })], 'ינון', cats)?.title, '💰 הכנסה חדשה');
});

Deno.test('several at once become one summary', () => {
  const m = txMessage([tx({ amount: 50 }), tx({ amount: 70 }), tx({ kind: 'income', amount: 300 })], 'דנה', cats);
  assertEquals(m?.body, 'דנה: 3 תנועות חדשות · הוצאות ₪120 · הכנסות ₪300');
});

Deno.test('transfers alone send nothing', () => {
  assertEquals(txMessage([tx({ kind: 'transfer' })], 'דנה', cats), null);
});

Deno.test('daily summary with top category and month so far', () => {
  const m = dailyMessage([tx({ amount: 200, category_id: 'c1' }), tx({ amount: 80, category_id: 'c2' })], cats, 4300);
  assertEquals(m.body, 'הוצאות ₪280 (2 תנועות) · הכי הרבה: 🛒 סופר ₪200 · מתחילת החודש: ₪4,300');
});

Deno.test('quiet day nudges gently', () => {
  assertEquals(dailyMessage([], cats, 0).body.startsWith('אתמול לא נרשמו תנועות'), true);
});

Deno.test('dates follow Israel time', () => {
  // 23:30 UTC on Nov 5 is already Nov 6 in Israel, so "yesterday" is Nov 5
  assertEquals(israelDates(new Date('2026-11-05T23:30:00Z')), { yesterday: '2026-11-05', monthStart: '2026-11-01' });
  assertEquals(israelDates(new Date('2026-12-01T06:00:00Z')), { yesterday: '2026-11-30', monthStart: '2026-11-01' });
});
