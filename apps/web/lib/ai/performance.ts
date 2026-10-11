/**
 * The assistant's performance panel (pure): per suggestion kind how many were filed, approved,
 * rejected (and why), edited, expired; acceptance rate; time to decision; model calls and cost;
 * an estimate of time saved. The estimate is a stated rule (minutes per approved suggestion), not
 * a measurement, and the screen says so.
 */

export type SuggestionStat = { kind: string; status: string; rejectReason: string | null; edited: boolean; createdAt: string; decidedAt: string | null };
export type UsageStat = { feature: string; calls: number; errors: number; inputTokens: number; outputTokens: number; costUsd: number | null };

/** Minutes of manual work an approved suggestion of a kind replaces (rule of thumb, shown on screen). */
export const MINUTES_SAVED: Record<string, number> = {
  'detector.late_order': 10, 'detector.shortage': 15, 'detector.stale_quote': 5, 'detector.overdue_receivable': 5,
  'detector.scrap_anomaly': 20, 'detector.capacity': 20, 'detector.expiry': 5, 'detector.offcut': 10,
  'production.cutting_plan': 30, 'procurement.purchase_draft': 15, 'stock.count_import': 45, 'installation.mark_delivered': 3,
};
/** Approvals of these kinds act on a delivery date before it slips. */
const DELAY_KINDS = new Set(['detector.late_order', 'detector.capacity', 'detector.shortage']);

export function performance(rows: SuggestionStat[], usage: UsageStat[], labels: Record<string, string>) {
  const kinds = new Map<string, SuggestionStat[]>();
  for (const r of rows) kinds.set(r.kind, [...(kinds.get(r.kind) ?? []), r]);
  const perKind = [...kinds.entries()].map(([kind, list]) => {
    const count = (s: string) => list.filter((r) => r.status === s).length;
    const approved = count('approved');
    const rejected = count('rejected');
    const decided = list.filter((r) => r.decidedAt && (r.status === 'approved' || r.status === 'rejected'));
    const hours = decided.map((r) => (Date.parse(r.decidedAt!) - Date.parse(r.createdAt)) / 3_600_000);
    const reasons: Record<string, number> = {};
    for (const r of list) if (r.status === 'rejected') reasons[r.rejectReason ?? 'unspecified'] = (reasons[r.rejectReason ?? 'unspecified'] ?? 0) + 1;
    return {
      kind, label: labels[kind] ?? kind, filed: list.length, approved, rejected, expired: count('expired'), pending: count('pending'),
      edited: list.filter((r) => r.edited).length,
      acceptance: approved + rejected ? Math.round((approved / (approved + rejected)) * 100) : null,
      medianHoursToDecide: hours.length ? Math.round(median(hours) * 10) / 10 : null,
      rejectReasons: reasons,
      minutesSaved: approved * (MINUTES_SAVED[kind] ?? 0),
    };
  }).sort((a, b) => b.filed - a.filed);
  const sum = (f: (k: (typeof perKind)[number]) => number) => perKind.reduce((s, k) => s + f(k), 0);
  const approved = sum((k) => k.approved);
  const rejected = sum((k) => k.rejected);
  const priced = usage.filter((u) => u.costUsd !== null);
  return {
    perKind,
    totals: {
      filed: sum((k) => k.filed), approved, rejected, edited: sum((k) => k.edited),
      acceptance: approved + rejected ? Math.round((approved / (approved + rejected)) * 100) : null,
      minutesSaved: sum((k) => k.minutesSaved),
      delaysActedOn: rows.filter((r) => r.status === 'approved' && DELAY_KINDS.has(r.kind)).length,
    },
    model: {
      calls: usage.reduce((s, u) => s + u.calls, 0), errors: usage.reduce((s, u) => s + u.errors, 0),
      tokens: usage.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0),
      costUsd: priced.length ? Math.round(priced.reduce((s, u) => s + (u.costUsd ?? 0), 0) * 10000) / 10000 : null,
      byFeature: usage.map((u) => ({ ...u })).sort((a, b) => b.calls - a.calls),
    },
  };
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
