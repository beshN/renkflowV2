import { morningSummary, type MorningFacts } from '@/lib/ai/insight/morning';

const f: MorningFacts = { lateOrders: 2, dueToday: 3, pendingSuggestions: 4, staleQuotes: 1, overdue: { count: 2, amount: 18500 }, myJobs: { count: 3, late: 1, titles: ['Kesim 7016', 'Montaj hazırlık'] } };

describe('morning summary per role', () => {
  it('owner: late, today, quotes, receivables with amount, suggestions', () => {
    const s = morningSummary('owner', f, { hidePrices: false, hour: 8 });
    expect(s.greeting).toBe('Günaydın');
    expect(s.lines.map((l) => l.key)).toEqual(['late', 'today', 'quotes', 'overdue', 'suggestions']);
    expect(s.lines[3].text).toBe('2 faturanın vadesi geçti (18.500 ₺ açık)');
  });
  it('worker: only their own jobs, no customers or money', () => {
    const s = morningSummary('worker', f, { hidePrices: false, hour: 7 });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].text).toBe('Bugün 3 işin var, 1 tanesi gecikmiş: Kesim 7016, Montaj hazırlık…');
    expect(JSON.stringify(s)).not.toMatch(/₺|fatura|sipariş/);
  });
  it('accountant gets receivables; a price-hiding role gets counts only; a quiet day is empty', () => {
    expect(morningSummary('accountant', f, { hidePrices: false, hour: 9 }).lines.map((l) => l.key)).toEqual(['overdue', 'suggestions']);
    expect(morningSummary('owner', f, { hidePrices: true, hour: 9 }).lines.find((l) => l.key === 'overdue')!.text).not.toMatch(/₺/);
    expect(morningSummary('office', { lateOrders: 0, dueToday: 0, pendingSuggestions: 0, staleQuotes: 0, overdue: null, myJobs: null }, { hidePrices: false, hour: 14 })).toEqual({ greeting: 'İyi günler', lines: [] });
  });
});
