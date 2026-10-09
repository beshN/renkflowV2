/** Stock and purchasing rules as pure functions: shortage, quote comparison, supplier score, price history. */

const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

export type Need = { itemId: string; name: string; uom: string; quantity: number };
export type Supply = { onHand: number; reservedByOthers: number; reservedForThis: number; incoming: number };

/**
 * What an order lacks: each material's need against what is free for it (on hand minus what other
 * jobs hold, plus what is already held for this order). Incoming purchases are shown, not counted.
 */
export function shortage(needs: Need[], supply: (itemId: string) => Supply) {
  const merged = new Map<string, Need>();
  for (const n of needs) {
    const m = merged.get(n.itemId);
    merged.set(n.itemId, m ? { ...m, quantity: m.quantity + n.quantity } : { ...n });
  }
  return [...merged.values()].map((n) => {
    const s = supply(n.itemId);
    const free = Math.max(0, s.onHand - s.reservedByOthers);
    const missing = round(Math.max(0, n.quantity - free));
    return { ...n, quantity: round(n.quantity), free: round(free), incoming: round(s.incoming), missing, coveredByIncoming: missing > 0 && s.incoming >= missing };
  }).sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name, 'tr'));
}

// Requests for quotation --------------------------------------------------------------------------

export type RfqLine = { id: string; quantity: number };
export type RfqResponse = { supplierId: string; supplierName: string; leadTimeDays: number | null; validUntil: string | null; prices: Array<{ lineId: string; unitPrice: number }> };

/**
 * Supplier answers side by side: each one's total for the lines it priced, whether it covers every
 * line, and the cheapest offer per line. The suggested choice covers every line at the lowest
 * total (then the shorter lead time); an expired answer is shown but never suggested.
 */
export function compareResponses(lines: RfqLine[], responses: RfqResponse[], today: string) {
  const rows = responses.map((r) => {
    const priced = lines.filter((l) => r.prices.some((p) => p.lineId === l.id));
    const total = round(priced.reduce((s, l) => s + l.quantity * (r.prices.find((p) => p.lineId === l.id)?.unitPrice ?? 0), 0), 2);
    const expired = !!r.validUntil && r.validUntil < today;
    return { supplierId: r.supplierId, supplierName: r.supplierName, leadTimeDays: r.leadTimeDays, validUntil: r.validUntil, total, complete: priced.length === lines.length, missing: lines.length - priced.length, expired };
  });
  const cheapest = Object.fromEntries(lines.map((l) => {
    const offers = responses.flatMap((r) => r.prices.filter((p) => p.lineId === l.id).map((p) => ({ supplierId: r.supplierId, unitPrice: p.unitPrice })));
    const best = offers.sort((a, b) => a.unitPrice - b.unitPrice)[0];
    return [l.id, best ?? null];
  }));
  const eligible = rows.filter((r) => r.complete && !r.expired).sort((a, b) => a.total - b.total || (a.leadTimeDays ?? 999) - (b.leadTimeDays ?? 999));
  return { rows, cheapest, suggested: eligible[0]?.supplierId ?? null };
}

// Supplier score ----------------------------------------------------------------------------------

export type SupplierOrder = { expectedAt: string | null; sentAt: string; firstReceiptAt: string | null; accepted: number; rejected: number };

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * A supplier's record over its received orders: on time (first receipt on or before the expected
 * day), rejected share of what arrived, average days late and actual lead time. The score weighs
 * punctuality 60 and quality 40; fewer than 3 received orders is "not enough data".
 */
export function supplierScore(orders: SupplierOrder[]) {
  const received = orders.filter((o) => o.firstReceiptAt);
  const timed = received.filter((o) => o.expectedAt);
  const onTime = timed.filter((o) => o.firstReceiptAt!.slice(0, 10) <= o.expectedAt!).length;
  const late = timed.map((o) => Math.max(0, days(o.expectedAt! + 'T00:00:00Z', o.firstReceiptAt!.slice(0, 10) + 'T00:00:00Z')));
  const arrived = received.reduce((s, o) => s + o.accepted + o.rejected, 0);
  const rejected = received.reduce((s, o) => s + o.rejected, 0);
  const onTimePct = timed.length ? Math.round((onTime / timed.length) * 100) : null;
  const rejectPct = arrived ? round((rejected / arrived) * 100, 1) : null;
  const leadTimes = received.map((o) => days(o.sentAt, o.firstReceiptAt!));
  const score = onTimePct == null && rejectPct == null ? null : Math.round(0.6 * (onTimePct ?? 100) + 0.4 * Math.max(0, 100 - (rejectPct ?? 0) * 5));
  const grade = score == null || received.length < 3 ? null : score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
  return {
    orders: orders.length,
    received: received.length,
    onTimePct,
    rejectPct,
    avgDaysLate: late.length ? round(late.reduce((s, d) => s + d, 0) / late.length, 1) : null,
    avgLeadDays: leadTimes.length ? round(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length, 1) : null,
    score,
    grade,
    enoughData: received.length >= 3,
  };
}

// Price history -----------------------------------------------------------------------------------

export type PricePoint = { itemId: string; itemName: string; supplierId: string; supplierName: string; currency: string; unitPrice: number; at: string; orderNumber: string };

/** Prices paid per item and supplier over time, with the change from the previous purchase. */
export function priceHistory(points: PricePoint[]) {
  const groups = new Map<string, PricePoint[]>();
  for (const p of points) {
    const key = `${p.itemId}\u0000${p.supplierId}\u0000${p.currency}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].map((g) => {
    const series = [...g].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const last = series[series.length - 1];
    const prev = series.length > 1 ? series[series.length - 2] : null;
    return {
      itemId: last.itemId, itemName: last.itemName, supplierId: last.supplierId, supplierName: last.supplierName, currency: last.currency,
      last: last.unitPrice, lastAt: last.at,
      changePct: prev && prev.unitPrice > 0 ? round(((last.unitPrice - prev.unitPrice) / prev.unitPrice) * 100, 1) : null,
      min: Math.min(...series.map((p) => p.unitPrice)), max: Math.max(...series.map((p) => p.unitPrice)),
      series: series.map((p) => ({ at: p.at, unitPrice: p.unitPrice, orderNumber: p.orderNumber })),
    };
  }).sort((a, b) => a.itemName.localeCompare(b.itemName, 'tr') || a.supplierName.localeCompare(b.supplierName, 'tr'));
}
