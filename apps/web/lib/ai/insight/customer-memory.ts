/**
 * Customer memory (pure): what the firm's own records say about a customer, each fact with the record
 * it comes from. Nothing is inferred beyond the records (no guessed tone, mood or credit score); a
 * fact with no record behind it is left out.
 */
export type MemoryInput = {
  orders: Array<{ id: string; number: string; date: string; total: number; currency?: string | null; status: string; colors: string[] }>;
  quotes: Array<{ id: string; number: string; date: string; status: string; colors: string[] }>;
  overdue: Array<{ number: string; dueOn: string; open: number; orderId: string }>;
  hidePrices: boolean;
  financeVisible: boolean;
};
export type MemoryFact = { key: string; label: string; value: string; sources: Array<{ label: string; href: string }> };

const tl = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`;
const trDate = (d: string) => d.split('-').reverse().join('.');

export function customerMemory(m: MemoryInput): MemoryFact[] {
  const facts: MemoryFact[] = [];
  const orders = [...m.orders].sort((a, b) => b.date.localeCompare(a.date));
  const live = orders.filter((o) => o.status !== 'cancelled');
  if (live.length) {
    const first = live[live.length - 1];
    facts.push({ key: 'since', label: 'İlk sipariş', value: trDate(first.date), sources: [{ label: first.number, href: `/orders/${first.id}` }] });
    // Lira orders are added up; others are counted, never converted.
    const tr = live.filter((o) => (o.currency ?? 'TRY') === 'TRY');
    const other = live.length - tr.length;
    const total = m.hidePrices ? '' : `${tr.length ? ` · toplam ${tl(tr.reduce((s, o) => s + o.total, 0))}` : ''}${other ? ` (+${other} döviz sipariş)` : ''}`;
    facts.push({
      key: 'orders', label: 'Siparişler', value: `${live.length} sipariş${total} · son: ${trDate(live[0].date)}`,
      sources: live.slice(0, 3).map((o) => ({ label: o.number, href: `/orders/${o.id}` })),
    });
  }
  if (m.quotes.length) {
    const decided = m.quotes.filter((q) => ['accepted', 'converted', 'rejected', 'expired'].includes(q.status));
    const won = decided.filter((q) => q.status === 'accepted' || q.status === 'converted').length;
    const last = [...m.quotes].sort((a, b) => b.date.localeCompare(a.date))[0];
    facts.push({
      key: 'quotes', label: 'Teklifler', value: `${m.quotes.length} teklif${decided.length ? ` · sonuçlananların %${Math.round((won / decided.length) * 100)}'i kabul` : ''} · son: ${trDate(last.date)}`,
      sources: [{ label: last.number, href: `/quotations/${last.id}` }],
    });
  }
  // Colours the customer chose on orders and quotes (a quote turned into an order counts once, as the
  // order); most used first, at least twice to count as a habit.
  const count = new Map<string, Array<{ label: string; href: string }>>();
  for (const o of m.orders) for (const c of new Set(o.colors)) count.set(c, [...(count.get(c) ?? []), { label: o.number, href: `/orders/${o.id}` }]);
  for (const q of m.quotes.filter((x) => x.status !== 'converted')) for (const c of new Set(q.colors)) count.set(c, [...(count.get(c) ?? []), { label: q.number, href: `/quotations/${q.id}` }]);
  const habits = [...count.entries()].filter(([, s]) => s.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 2);
  if (habits.length) facts.push({ key: 'colors', label: 'Sık seçtiği renk', value: habits.map(([c, s]) => `${c} (${s.length} kez)`).join(', '), sources: habits[0][1].slice(0, 3) });
  if (m.financeVisible && m.overdue.length) {
    facts.push({
      key: 'overdue', label: 'Vadesi geçmiş', value: `${m.overdue.length} fatura${m.hidePrices ? '' : ` · ${tl(m.overdue.reduce((s, i) => s + i.open, 0))} açık`} · en eski vade ${trDate([...m.overdue].sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0].dueOn)}`,
      sources: m.overdue.slice(0, 3).map((i) => ({ label: i.number, href: `/orders/${i.orderId}` })),
    });
  }
  return facts;
}
