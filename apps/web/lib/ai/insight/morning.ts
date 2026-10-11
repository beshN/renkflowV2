/**
 * The morning summary per role (pure, no model): a few lines, each a count from the records with a
 * link to the list behind it. A worker sees only their own jobs (no customers, no money); a role
 * that hides prices gets counts without amounts. An empty day says so instead of filling space.
 */
export type MorningFacts = {
  lateOrders: number; dueToday: number; pendingSuggestions: number; staleQuotes: number;
  overdue: { count: number; amount: number } | null;
  myJobs: { count: number; late: number; titles: string[] } | null;
};
export type MorningLine = { key: string; text: string; href: string; tone: 'danger' | 'warn' | 'info' };

const tl = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`;

export function morningSummary(role: string, f: MorningFacts, opts: { hidePrices: boolean; hour: number }): { greeting: string; lines: MorningLine[] } {
  const greeting = opts.hour < 12 ? 'Günaydın' : opts.hour < 18 ? 'İyi günler' : 'İyi akşamlar';
  const lines: MorningLine[] = [];
  const push = (l: MorningLine | false) => { if (l) lines.push(l); };
  if (role === 'worker') {
    const j = f.myJobs;
    push(!!j && j.count > 0 && { key: 'jobs', text: `Bugün ${j.count} işin var${j.late ? `, ${j.late} tanesi gecikmiş` : ''}: ${j.titles.join(', ')}${j.count > j.titles.length ? '…' : ''}`, href: '/factory', tone: j.late ? 'danger' : 'info' });
    return { greeting, lines };
  }
  const office = ['owner', 'admin', 'office', 'member'].includes(role);
  const finance = ['owner', 'admin', 'accountant'].includes(role);
  if (office) {
    push(f.lateOrders > 0 && { key: 'late', text: `${f.lateOrders} sipariş terminini geçti`, href: '/orders?view=overdue', tone: 'danger' });
    push(f.dueToday > 0 && { key: 'today', text: `Bugün ${f.dueToday} teslim var`, href: '/orders?view=today', tone: 'info' });
    push(f.staleQuotes > 0 && { key: 'quotes', text: `${f.staleQuotes} teklif 3 günden uzun süredir cevap bekliyor`, href: '/quotations', tone: 'warn' });
  }
  if (finance && f.overdue && f.overdue.count > 0)
    push({ key: 'overdue', text: `${f.overdue.count} faturanın vadesi geçti${opts.hidePrices ? '' : ` (${tl(f.overdue.amount)} açık)`}`, href: '/finance/receivables', tone: 'danger' });
  push(f.pendingSuggestions > 0 && { key: 'suggestions', text: `Asistanın ${f.pendingSuggestions} önerisi onayınızı bekliyor`, href: '/assistant', tone: 'info' });
  return { greeting, lines };
}
