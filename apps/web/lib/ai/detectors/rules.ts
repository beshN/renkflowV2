/**
 * The eight proactive detectors' rules (pure). Each takes rows its loader read from the database,
 * "today" and the firm's settings, and returns findings with their evidence. No model, no clock,
 * no database: every number on a card comes from here and is unit-tested.
 */
import { addDays, countBadge, daysBadge, daysBetween, moneyBadge, type Badge, type DetectorSettings, type Finding, type Priority } from './engine';
import { lateOrderMessage, paymentReminderMessage, quoteFollowUpMessage, type Tone } from './messages';

const fmt = (d: string) => d.slice(0, 10).split('-').reverse().join('.');

// 1. Late / risky order --------------------------------------------------------------------------

export type OrderRow = {
  id: string; number: string; customer: string | null; tone: Tone; firm: string | null;
  /** Promised date if set, else planned delivery date. */
  dueOn: string | null; promised: string | null;
  /** 0 = quote … 5 = delivery (lifecycle step), -1 = on hold. */
  step: number;
  lastMoveOn: string | null;
  missingMaterials: number;
  /** Longest supplier lead time among missing materials (days), if known. */
  materialLeadDays: number | null;
  openDelay: { reason: string; expectedUntil: string | null } | null;
};
export type LatePayload = { orderId: string; newPromiseDate: string; reason: string; message?: string };

/** Days a lifecycle step is expected to take when estimating a new date (rule, not a guess). */
export const STEP_DAYS = 2;

export function detectLateOrders(rows: OrderRow[], today: string, s: DetectorSettings): Finding<LatePayload>[] {
  const window = s.threshold ?? 3;
  const out: Finding<LatePayload>[] = [];
  for (const o of rows) {
    if (!o.dueOn) continue;
    const left = daysBetween(today, o.dueOn);
    const stalled = o.lastMoveOn ? daysBetween(o.lastMoveOn, today) : 0;
    const stepsLeft = Math.max(1, 5 - Math.max(0, o.step));
    const late = left < 0;
    const atRisk = !late && left <= window && (stalled >= 2 || o.missingMaterials > 0 || o.openDelay !== null || o.step < 0 || stepsLeft * STEP_DAYS > left);
    const shortSoon = !late && !atRisk && left <= 7 && o.missingMaterials > 0;
    if (!late && !atRisk && !shortSoon) continue;
    // The new date: remaining steps at the rule pace, after material arrives and after an open delay.
    let estimate = addDays(today, stepsLeft * STEP_DAYS);
    if (o.missingMaterials > 0) estimate = maxDay(estimate, addDays(today, (o.materialLeadDays ?? 7) + STEP_DAYS));
    if (o.openDelay?.expectedUntil) estimate = maxDay(estimate, addDays(o.openDelay.expectedUntil, STEP_DAYS));
    const newDate = maxDay(estimate, addDays(o.dueOn, 1));
    const reason = o.missingMaterials > 0 ? 'malzeme tedariki' : o.openDelay ? `üretimdeki gecikme (${o.openDelay.reason})` : 'üretim yoğunluğu';
    const badges: Badge[] = [late ? daysBadge(-left, 'gün gecikti', 'danger') : daysBadge(left, 'gün kaldı', left <= 1 ? 'danger' : 'warning')];
    if (stalled >= 2) badges.push(daysBadge(stalled, 'gündür aynı aşamada', 'warning'));
    if (o.missingMaterials > 0) badges.push(countBadge(o.missingMaterials, 'malzeme eksik', 'danger'));
    const priority: Priority = late || left <= 1 ? 'high' : 'medium';
    out.push({
      detector: 'late_order', dedupeKey: `late:${o.id}`, priority, confidence: o.step >= 0 ? 'high' : 'medium',
      title: late ? `${o.number} termini geçti` : `${o.number} termine yetişmeyebilir`,
      rationale: `${late ? `Termin ${fmt(o.dueOn)} geçti` : `Termine ${left} gün kaldı`}; ${stepsLeft} aşama var${stalled >= 2 ? `, ${stalled} gündür ilerlemiyor` : ''}${o.missingMaterials ? `, ${o.missingMaterials} malzeme eksik` : ''}. Müşteriye bilgi ve yeni tarih (${fmt(newDate)}) önerilir.`,
      rule: `Termin geçti ya da ≤ ${window} gün kaldı ve (aşama ≥ 2 gün ilerlemedi, malzeme eksik, açık gecikme var veya kalan aşama × ${STEP_DAYS} gün termine sığmıyor)`,
      evidence: { badges, records: [{ entityType: 'order', entityId: o.id, label: o.number, href: `/orders/${o.id}` }], numbers: { termin: o.dueOn, kalanGün: left, aşamaBekleme: stalled, kalanAşama: stepsLeft, eksikMalzeme: o.missingMaterials, yeniTarih: newDate } },
      payload: { orderId: o.id, newPromiseDate: newDate, reason },
      draft: { channel: 'message', to: o.customer, tone: o.tone, text: lateOrderMessage({ customer: o.customer, firm: o.firm, orderNumber: o.number, oldDate: o.dueOn, newDate, reason, tone: o.tone }) },
    });
  }
  return out;
}
const maxDay = (a: string, b: string) => (a > b ? a : b);

// 2. Material shortage across open work ---------------------------------------------------------

export type SupplierOption = { supplierId: string; name: string; unitPrice: number | null; currency: string; score: number | null; leadDays: number | null };
export type ShortageRow = {
  itemId: string; name: string; uom: string;
  /** Still needed by open jobs (not yet reserved or issued). */
  demand: number; free: number; incoming: number;
  orderMultiple: number | null;
  jobs: Array<{ id: string; label: string; href?: string; dueOn: string | null }>;
  suppliers: SupplierOption[];
  /** For metre items: the bar length and colour of the last purchase (required for a draft). */
  lengthMm: number | null; color: string | null;
};
export type ShortagePayload = { itemId: string; quantity: number; supplierId: string | null; unitPrice: number | null; currency: string; lengthMm: number | null; color: string | null };

/** The best supplier: highest score; among equals (or no scores) the cheapest; else the fastest. */
export function pickSupplier(options: SupplierOption[]): SupplierOption | null {
  const priced = options.filter((o) => o.unitPrice !== null);
  if (!priced.length) return options[0] ?? null;
  return [...priced].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.unitPrice! - b.unitPrice!) || ((a.leadDays ?? 99) - (b.leadDays ?? 99)))[0];
}

export function detectShortages(rows: ShortageRow[], today: string): Finding<ShortagePayload>[] {
  const out: Finding<ShortagePayload>[] = [];
  for (const r of rows) {
    const missing = Math.round((r.demand - r.free - r.incoming) * 1000) / 1000;
    if (!(missing > 0)) continue;
    // Profiles kept in metres are bought in bars: the line quantity is a bar count (the purchase
    // command multiplies by the bar length). Without a known bar length nothing is ordered blind.
    const metres = r.uom === 'm';
    const barM = metres && r.lengthMm ? r.lengthMm / 1000 : null;
    const multiple = !metres && r.orderMultiple && r.orderMultiple > 0 ? r.orderMultiple : 1;
    const quantity = metres ? (barM ? Math.ceil(missing / barM) : 0) : Math.ceil(missing / multiple) * multiple;
    const best = metres && !barM ? null : pickSupplier(r.suppliers);
    const firstDue = r.jobs.map((j) => j.dueOn).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
    const daysToDue = firstDue ? daysBetween(today, firstDue) : null;
    const priority: Priority = daysToDue !== null && daysToDue <= 7 ? 'high' : 'medium';
    const badges: Badge[] = [countBadge(missing, `${r.uom} eksik`, 'danger'), countBadge(r.jobs.length, 'iş bekliyor', 'warning')];
    if (best?.unitPrice) badges.push(moneyBadge(best.unitPrice * quantity));
    if (metres && barM) badges.push(countBadge(quantity, 'çubuk', 'info'));
    out.push({
      detector: 'shortage', dedupeKey: `short:${r.itemId}`, priority, confidence: best?.unitPrice ? 'high' : 'low',
      title: `${r.name}: ${missing.toLocaleString('tr-TR')} ${r.uom} eksik`,
      rationale: `Açık işler ${r.demand.toLocaleString('tr-TR')} ${r.uom} istiyor; serbest stok ${r.free.toLocaleString('tr-TR')}, yolda ${r.incoming.toLocaleString('tr-TR')}.${best ? ` Önerilen tedarikçi: ${best.name}${best.unitPrice !== null ? ` (son fiyat ${best.unitPrice.toLocaleString('tr-TR')} ${best.currency})` : ''}.` : ' Bu kalem için tedarikçi geçmişi yok.'}`,
      rule: 'Açık işlerin ayrılmamış ihtiyacı > serbest stok + yoldaki sipariş',
      evidence: {
        badges, records: r.jobs.slice(0, 20).map((j) => ({ entityType: 'work_order', entityId: j.id, label: j.label, href: j.href })),
        numbers: { ihtiyaç: r.demand, serbest: r.free, yolda: r.incoming, eksik: missing, sipariş: quantity, birim: metres ? 'çubuk' : r.uom, ilkTermin: firstDue, tedarikçiSayısı: r.suppliers.length },
      },
      payload: { itemId: r.itemId, quantity, supplierId: best?.supplierId ?? null, unitPrice: best?.unitPrice ?? null, currency: best?.currency ?? 'TRY', lengthMm: r.lengthMm, color: r.color },
    });
  }
  return out;
}

// 3. Quote waiting for an answer ---------------------------------------------------------------

export type QuoteRow = { id: string; number: string; customer: string | null; tone: Tone; firm: string | null; sentOn: string; validUntil: string | null; total: number; currency: string };
export type QuotePayload = { quotationId: string; step: 1 | 2; message?: string };

export function detectStaleQuotes(rows: QuoteRow[], today: string, s: DetectorSettings): Finding<QuotePayload>[] {
  const first = s.threshold ?? 3;
  const second = Math.max(first + 1, 7);
  const out: Finding<QuotePayload>[] = [];
  for (const q of rows) {
    const days = daysBetween(q.sentOn, today);
    if (days < first) continue;
    if (q.validUntil && q.validUntil < today) continue;
    const step: 1 | 2 = days >= second ? 2 : 1;
    const validLeft = q.validUntil ? daysBetween(today, q.validUntil) : null;
    const badges: Badge[] = [daysBadge(days, 'gün cevapsız', step === 2 ? 'danger' : 'warning'), moneyBadge(q.total)];
    if (validLeft !== null) badges.push(daysBadge(validLeft, 'gün geçerli', validLeft <= 3 ? 'danger' : 'info'));
    out.push({
      detector: 'stale_quote', dedupeKey: `quote:${q.id}:${step}`, priority: step === 2 || (validLeft !== null && validLeft <= 3) ? 'high' : 'medium', confidence: 'high',
      title: `${q.number} ${days} gündür cevapsız`,
      rationale: `Teklif ${fmt(q.sentOn)} tarihinde gönderildi, müşteri henüz karar vermedi.${validLeft !== null ? ` Geçerliliğin bitmesine ${validLeft} gün var.` : ''} ${step === 1 ? 'Kısa bir hatırlatma' : 'İkinci takip'} önerilir.`,
      rule: `Gönderilmiş teklif ${first} (ilk takip) / ${second} (ikinci takip) gündür kararsız ve süresi dolmamış`,
      evidence: { badges, records: [{ entityType: 'quotation', entityId: q.id, label: q.number, href: `/quotations/${q.id}` }], numbers: { gönderim: q.sentOn, gün: days, geçerlilik: q.validUntil, tutar: q.total } },
      payload: { quotationId: q.id, step },
      draft: { channel: 'message', to: q.customer, tone: q.tone, text: quoteFollowUpMessage({ customer: q.customer, firm: q.firm, quoteNumber: q.number, days, validUntil: q.validUntil, step, tone: q.tone }) },
    });
  }
  return out;
}

// 4. Overdue receivable ------------------------------------------------------------------------

export type OverdueRow = { invoiceId: string; number: string; orderId: string; orderNumber: string; customer: string | null; tone: Tone; firm: string | null; dueOn: string; openAmount: number; currency: string };
export type OverduePayload = { invoiceId: string; orderId: string; step: 1 | 2; message?: string };

export function detectOverdue(rows: OverdueRow[], today: string, s: DetectorSettings): Finding<OverduePayload>[] {
  const second = s.threshold ?? 15;
  return rows.flatMap((r) => {
    const late = daysBetween(r.dueOn, today);
    if (late < 1 || !(r.openAmount > 0)) return [];
    const step: 1 | 2 = late >= second ? 2 : 1;
    return [{
      detector: 'overdue_receivable', dedupeKey: `due:${r.invoiceId}:${step}`, priority: late > 30 ? 'high' : 'medium', confidence: 'high',
      title: `${r.number} vadesi ${late} gün geçti`,
      rationale: `${r.customer ?? 'Müşteri'} · ${r.orderNumber}: ${fmt(r.dueOn)} vadeli faturada ${r.openAmount.toLocaleString('tr-TR')} ${r.currency} açık. ${step === 1 ? 'Nazik bir hatırlatma' : 'Ödeme planı teklifli ikinci hatırlatma'} önerilir.`,
      rule: `Kesilmiş fatura vadesinden ≥ 1 gün (ikinci hatırlatma ≥ ${second} gün) geçti ve açık bakiye var`,
      evidence: { badges: [daysBadge(late, 'gün gecikti', late > 30 ? 'danger' : 'warning'), moneyBadge(r.openAmount, 'danger')], records: [{ entityType: 'order', entityId: r.orderId, label: `${r.number} · ${r.orderNumber}`, href: `/orders/${r.orderId}` }], numbers: { vade: r.dueOn, gecikme: late, açık: r.openAmount } },
      payload: { invoiceId: r.invoiceId, orderId: r.orderId, step },
      draft: { channel: 'message', to: r.customer, tone: r.tone, text: paymentReminderMessage({ customer: r.customer, firm: r.firm, invoiceNumber: r.number, dueOn: r.dueOn, openAmount: r.openAmount, currency: r.currency, daysOverdue: late, tone: r.tone }) },
    } satisfies Finding<OverduePayload>];
  });
}

// 5. Scrap anomaly ------------------------------------------------------------------------------

export type ScrapRow = { dimension: 'item' | 'color' | 'worker' | 'center'; key: string; label: string; recent: number; baseline: number[]; topReason: string | null; sampleWorkOrderId: string | null; sampleLabel: string | null };
export type ScrapPayload = { dimension: ScrapRow['dimension']; key: string; label: string; workOrderId: string | null; topReason: string | null };
const DIM_LABEL: Record<ScrapRow['dimension'], string> = { item: 'malzeme', color: 'renk', worker: 'usta', center: 'istasyon' };

/**
 * Last 30 days against the average of the three 30-day windows before: an anomaly when at least
 * `threshold` (3) events and at least twice the usual. The top reason code says what to look at.
 */
export function detectScrapAnomalies(rows: ScrapRow[], s: DetectorSettings): Finding<ScrapPayload>[] {
  const min = s.threshold ?? 3;
  return rows.flatMap((r) => {
    const avg = r.baseline.length ? r.baseline.reduce((a, b) => a + b, 0) / r.baseline.length : 0;
    if (r.recent < min || r.recent < 2 * Math.max(avg, 0.5)) return [];
    const ratio = avg > 0 ? Math.round((r.recent / avg) * 10) / 10 : null;
    return [{
      detector: 'scrap_anomaly', dedupeKey: `scrap:${r.dimension}:${r.key}`, priority: ratio === null || ratio >= 3 ? 'high' : 'medium', confidence: r.baseline.some((b) => b > 0) ? 'high' : 'medium',
      title: `Fire artışı: ${r.label} (${DIM_LABEL[r.dimension]})`,
      rationale: `Son 30 günde ${r.recent} fire; önceki dönemlerin ortalaması ${Math.round(avg * 10) / 10}.${r.topReason ? ` En sık neden: ${r.topReason}.` : ''} Neden odaklı bir inceleme önerilir.`,
      rule: `Son 30 gün ≥ ${min} fire ve önceki 3 × 30 günlük ortalamanın ≥ 2 katı`,
      evidence: {
        badges: [countBadge(r.recent, 'fire / 30 gün', 'danger'), { label: ratio ? `${ratio}× normal` : 'yeni', tone: 'warning', kind: 'percent' }, ...(r.topReason ? [{ label: r.topReason, tone: 'info' as const, kind: 'text' as const }] : [])],
        records: r.sampleWorkOrderId ? [{ entityType: 'work_order', entityId: r.sampleWorkOrderId, label: r.sampleLabel ?? 'İş emri', href: `/work-orders/${r.sampleWorkOrderId}` }] : [],
        numbers: { son30: r.recent, ortalama: Math.round(avg * 10) / 10, kat: ratio, neden: r.topReason },
      },
      payload: { dimension: r.dimension, key: r.key, label: r.label, workOrderId: r.sampleWorkOrderId, topReason: r.topReason },
    } satisfies Finding<ScrapPayload>];
  });
}

// 6. Capacity conflict --------------------------------------------------------------------------

export type ScheduledJob = { workOrderId: string; label: string; center: string; dueAt: string | null; finishAt: string; priority: 'low' | 'medium' | 'high' | 'critical'; late: boolean };
export type CapacityPayload = { lateWorkOrderId: string; moveWorkOrderId: string | null };
const PRI: Record<ScheduledJob['priority'], number> = { low: 0, medium: 1, high: 2, critical: 3 };

/**
 * A job the schedule finishes after its due date. The job that can give way: same station, not
 * more urgent, finishing before the late one, with at least as many days of slack as the late job
 * is late. Approving raises the late job and lowers the one that gives way.
 */
export function detectCapacity(jobs: ScheduledJob[]): Finding<CapacityPayload>[] {
  const out: Finding<CapacityPayload>[] = [];
  for (const j of jobs.filter((x) => x.late && x.dueAt)) {
    const lateDays = Math.max(1, Math.ceil((Date.parse(j.finishAt) - Date.parse(j.dueAt!)) / 86_400_000));
    const candidates = jobs
      .filter((c) => c.workOrderId !== j.workOrderId && c.center === j.center && !c.late && c.finishAt < j.finishAt && PRI[c.priority] <= PRI[j.priority])
      .map((c) => ({ c, slack: c.dueAt ? Math.floor((Date.parse(c.dueAt) - Date.parse(c.finishAt)) / 86_400_000) : 999 }))
      .filter((x) => x.slack >= lateDays)
      .sort((a, b) => PRI[a.c.priority] - PRI[b.c.priority] || b.slack - a.slack);
    const move = candidates[0]?.c ?? null;
    out.push({
      detector: 'capacity', dedupeKey: `cap:${j.workOrderId}`, priority: 'high', confidence: move ? 'high' : 'medium',
      title: move ? `${j.label} termine yetişmiyor; ${move.label} kayabilir` : `${j.label} bu planla termine yetişmiyor`,
      rationale: `Plan ${j.label} işini termininden ${lateDays} gün sonra bitiriyor (${j.center}).${move ? ` ${move.label} işinin ${candidates[0].slack} gün payı var; sırası öne alınan işe verilebilir.` : ' Aynı istasyonda kaydırılabilecek iş bulunamadı; fazla mesai ya da termin değişikliği gerekir.'}`,
      rule: 'Planlanan bitiş > termin; kayabilecek iş = aynı istasyon, daha acil değil, daha önce bitiyor, payı ≥ gecikme',
      evidence: {
        badges: [daysBadge(lateDays, 'gün geç biter', 'danger'), { label: j.center, tone: 'info', kind: 'text' }, ...(move ? [daysBadge(candidates[0].slack, 'gün pay', 'success')] : [])],
        records: [{ entityType: 'work_order', entityId: j.workOrderId, label: j.label, href: `/work-orders/${j.workOrderId}` }, ...(move ? [{ entityType: 'work_order', entityId: move.workOrderId, label: move.label, href: `/work-orders/${move.workOrderId}` }] : [])],
        numbers: { termin: j.dueAt, planlananBitiş: j.finishAt, gecikme: lateDays, kayanİş: move?.label ?? null },
      },
      payload: { lateWorkOrderId: j.workOrderId, moveWorkOrderId: move?.workOrderId ?? null },
    });
  }
  return out;
}

// 7. Document / maintenance expiry ---------------------------------------------------------------

export type ExpiryRow = { vehicleId: string; plate: string; kind: string; kindLabel: string; dueOn: string; source: 'document' | 'maintenance' };
export type ExpiryPayload = { vehicleId: string; kind: string; dueOn: string };

export function detectExpiries(rows: ExpiryRow[], today: string, s: DetectorSettings): Finding<ExpiryPayload>[] {
  const window = s.threshold ?? 15;
  return rows.flatMap((r) => {
    const left = daysBetween(today, r.dueOn);
    if (left > window) return [];
    const expired = left < 0;
    return [{
      detector: 'expiry', dedupeKey: `exp:${r.vehicleId}:${r.kind}:${r.dueOn}`, priority: expired || left <= 7 ? 'high' : 'medium', confidence: 'high',
      title: expired ? `${r.plate}: ${r.kindLabel} süresi geçti` : `${r.plate}: ${r.kindLabel} ${left} gün içinde`,
      rationale: `${r.kindLabel} ${fmt(r.dueOn)} tarihinde ${expired ? 'doldu' : 'doluyor'}. Yenileme için bir görev açılması önerilir.`,
      rule: `${r.source === 'document' ? 'Belge bitişi' : 'Bakım tarihi'} ≤ ${window} gün`,
      evidence: { badges: [expired ? daysBadge(-left, 'gün geçti', 'danger') : daysBadge(left, 'gün kaldı', left <= 7 ? 'danger' : 'warning'), { label: r.kindLabel, tone: 'info', kind: 'text' }], records: [{ entityType: 'vehicle', entityId: r.vehicleId, label: r.plate, href: `/vehicles/${r.vehicleId}` }], numbers: { bitiş: r.dueOn, kalan: left } },
      payload: { vehicleId: r.vehicleId, kind: r.kind, dueOn: r.dueOn },
    } satisfies Finding<ExpiryPayload>];
  });
}

// 8. Offcut / idle stock use -------------------------------------------------------------------

export type Remnant = { lotId: string; lotNumber: string; itemId: string; color: string | null; lengthMm: number; ageDays: number };
export type Cut = { workOrderId: string; label: string; itemId: string; color: string | null; lengthMm: number; quantity: number };
export type OffcutPayload = { workOrderId: string; lotIds: string[] };

/**
 * Open cuts a waiting offcut can cover (same profile and colour, long enough with the kerf). One
 * finding per job: which offcuts, how many new-bar cuts that saves; older offcuts first.
 */
export function detectOffcuts(remnants: Remnant[], cuts: Cut[], kerfMm: number): Finding<OffcutPayload>[] {
  const free = [...remnants].sort((a, b) => b.ageDays - a.ageDays || a.lengthMm - b.lengthMm);
  const used = new Set<string>();
  const byJob = new Map<string, { label: string; matches: Array<{ r: Remnant; cut: number }> }>();
  for (const c of [...cuts].sort((a, b) => b.lengthMm - a.lengthMm)) {
    for (let n = 0; n < c.quantity; n++) {
      // Best fit: the shortest free offcut that still takes the cut.
      const r = free.filter((x) => !used.has(x.lotId) && x.itemId === c.itemId && (x.color ?? '') === (c.color ?? '') && x.lengthMm >= c.lengthMm + kerfMm).sort((a, b) => a.lengthMm - b.lengthMm)[0];
      if (!r) break;
      used.add(r.lotId);
      const e = byJob.get(c.workOrderId) ?? { label: c.label, matches: [] };
      e.matches.push({ r, cut: c.lengthMm });
      byJob.set(c.workOrderId, e);
    }
  }
  return [...byJob.entries()].map(([workOrderId, e]) => {
    const oldest = Math.max(...e.matches.map((m) => m.r.ageDays));
    const saved = e.matches.reduce((s, m) => s + m.cut, 0);
    return {
      detector: 'offcut', dedupeKey: `offcut:${workOrderId}:${e.matches.map((m) => m.r.lotId).sort().join(',')}`, priority: oldest > 60 ? 'medium' : 'low', confidence: 'high',
      title: `${e.label}: ${e.matches.length} kesim artık parçadan çıkar`,
      rationale: `${e.matches.map((m) => `${m.r.lotNumber} (${m.r.lengthMm.toLocaleString('tr-TR')} mm → ${m.cut.toLocaleString('tr-TR')} mm)`).join(', ')}. Yeni çubuk yerine bekleyen artıklar kullanılabilir.`,
      rule: 'Aynı profil ve renk, artık boyu ≥ kesim + testere payı; en kısa uyan artık seçilir',
      evidence: {
        badges: [countBadge(e.matches.length, 'artık uygun', 'success'), { label: `${(saved / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} m`, tone: 'info', kind: 'count' }, ...(oldest > 30 ? [daysBadge(oldest, 'gündür bekliyor', 'warning')] : [])],
        records: [{ entityType: 'work_order', entityId: workOrderId, label: e.label, href: `/work-orders/${workOrderId}` }],
        numbers: { kesim: e.matches.length, kazanılanMm: saved, enEskiGün: oldest },
      },
      payload: { workOrderId, lotIds: e.matches.map((m) => m.r.lotId) },
    } satisfies Finding<OffcutPayload>;
  });
}
