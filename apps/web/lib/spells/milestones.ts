/** Order counts worth a small celebration, smallest first. */
export const ORDER_MILESTONES = [10, 100, 1000, 10000] as const;

export function milestoneStorageKey(tenantId: string, milestone: number) {
  return `renkflow.milestone.${tenantId}.${milestone}`;
}

/**
 * The milestone to celebrate for a firm with `count` orders, or null. Only the highest
 * milestone reached is ever offered: a firm that already passed several before this
 * shipped sees just the top one, once. A milestone already seen (or a higher one) means
 * nothing to show.
 */
export function milestoneToShow(count: number | null | undefined, seen: Iterable<number>): number | null {
  if (typeof count !== 'number' || !Number.isFinite(count)) return null;
  const reached = ORDER_MILESTONES.filter((m) => count >= m);
  if (!reached.length) return null;
  const highest = reached[reached.length - 1];
  for (const m of seen) if (m >= highest) return null;
  return highest;
}

/** "1.000." — Turkish ordinal with a thousands dot. */
export function milestoneOrdinal(milestone: number) {
  return `${milestone.toLocaleString('tr-TR')}.`;
}

const WARM_LINES: Record<number, string> = {
  10: 'İlk on iş tamam. Her köklü atölye böyle başladı.',
  100: 'Yüz iş, yerine oturmuş yüz kapı ve pencere. Emeğinize sağlık.',
  1000: 'Bin iş! Ekibinizin ustalığı her profilde, her köşede belli.',
  10000: 'On bin iş. Bu artık bir zanaat geleneği. Nice on binlere!',
};

export function milestoneLine(milestone: number) {
  return WARM_LINES[milestone] ?? 'Emeğinize sağlık.';
}

export function milestoneShareText(milestone: number) {
  return `Atölyemiz ${milestoneOrdinal(milestone)} işine ulaştı. Emeği geçen herkese teşekkürler! (RenkFlow)`;
}
