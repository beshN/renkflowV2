/**
 * Fleet rules (pure): document expiry warnings, vehicle health, costs, assignment conflicts, and
 * the telemetry side — position validation, route distance, stops and daily kilometres.
 */

export const VEHICLE_TYPES = ['van', 'truck', 'pickup', 'car', 'other'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = { van: 'Panelvan', truck: 'Kamyon', pickup: 'Kamyonet', car: 'Binek', other: 'Diğer' };
export const VEHICLE_STATUSES = ['active', 'maintenance', 'out_of_service', 'sold'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = { active: 'Kullanımda', maintenance: 'Bakımda', out_of_service: 'Hizmet dışı', sold: 'Satıldı' };
export const DOCUMENT_KINDS = ['inspection', 'traffic_insurance', 'casco', 'registration', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = { inspection: 'Muayene', traffic_insurance: 'Trafik sigortası', casco: 'Kasko', registration: 'Ruhsat', other: 'Diğer' };

/** "34 abc 123" → "34ABC123"; null when it does not look like a Turkish plate. */
export function normalizePlate(raw: string) {
  const p = raw.toLocaleUpperCase('tr-TR').replace(/[^0-9A-ZÇĞİÖŞÜ]/g, '');
  return /^(0[1-9]|[1-7]\d|8[01])[A-Z]{1,3}\d{2,4}$/.test(p) ? p : null;
}
/** "34ABC123" → "34 ABC 123" for display. */
export const formatPlate = (p: string) => p.replace(/^(\d{2})([A-Z]+)(\d+)$/, '$1 $2 $3');

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY);

export type DocLevel = 'expired' | 'd7' | 'd15' | 'd30' | 'ok' | 'none';
/** A document's warning level: expired, within 7/15/30 days, fine, or no expiry date. */
export function documentLevel(expiresOn: string | null | undefined, today: string): { level: DocLevel; daysLeft: number | null } {
  if (!expiresOn) return { level: 'none', daysLeft: null };
  const daysLeft = daysBetween(today, expiresOn.slice(0, 10));
  const level: DocLevel = daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'd7' : daysLeft <= 15 ? 'd15' : daysLeft <= 30 ? 'd30' : 'ok';
  return { level, daysLeft };
}
export const DOC_LEVEL_LABEL: Record<DocLevel, string> = { expired: 'Süresi geçti', d7: '7 gün içinde', d15: '15 gün içinde', d30: '30 gün içinde', ok: 'Geçerli', none: 'Bitiş yok' };

export type Doc = { kind: string; expiresOn: string | null };
/** Of each kind only the latest document counts (an older, expired policy that was renewed does not warn). */
export function currentDocuments<T extends Doc>(docs: T[]): T[] {
  const best = new Map<string, T>();
  for (const d of docs) {
    const cur = best.get(d.kind);
    if (!cur || (d.expiresOn ?? '') > (cur.expiresOn ?? '')) best.set(d.kind, d);
  }
  return [...best.values()];
}

/** The documents that need attention today, worst first. */
export function documentAlerts<T extends Doc>(docs: T[], today: string) {
  const order: DocLevel[] = ['expired', 'd7', 'd15', 'd30'];
  return currentDocuments(docs)
    .map((d) => ({ ...d, ...documentLevel(d.expiresOn, today) }))
    .filter((d) => order.includes(d.level))
    .sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
}

export type Health = 'good' | 'attention' | 'critical';
/**
 * A vehicle's health: critical when a required document (inspection, traffic insurance) has expired
 * or maintenance is overdue; attention when something is within 15 days / 1000 km.
 */
export function vehicleHealth(v: { docs: Doc[]; odometerKm: number | null; nextService: { dueOn: string | null; dueKm: number | null } | null }, today: string) {
  const reasons: Array<{ level: Health; text: string }> = [];
  const required = new Set(['inspection', 'traffic_insurance']);
  for (const d of documentAlerts(v.docs, today)) {
    const label = DOCUMENT_KIND_LABELS[d.kind as DocumentKind] ?? d.kind;
    if (d.level === 'expired') reasons.push({ level: required.has(d.kind) ? 'critical' : 'attention', text: `${label} süresi geçti` });
    else if (d.level === 'd7' || d.level === 'd15') reasons.push({ level: 'attention', text: `${label} ${d.daysLeft} gün içinde bitiyor` });
  }
  for (const k of required) if (!currentDocuments(v.docs).some((d) => d.kind === k)) reasons.push({ level: 'attention', text: `${DOCUMENT_KIND_LABELS[k as DocumentKind]} kaydı yok` });
  if (v.nextService) {
    const { dueOn, dueKm } = v.nextService;
    if (dueOn) {
      const left = daysBetween(today, dueOn.slice(0, 10));
      if (left < 0) reasons.push({ level: 'critical', text: 'Bakım tarihi geçti' });
      else if (left <= 15) reasons.push({ level: 'attention', text: `Bakıma ${left} gün` });
    }
    if (dueKm !== null && v.odometerKm !== null) {
      const left = dueKm - v.odometerKm;
      if (left < 0) reasons.push({ level: 'critical', text: 'Bakım km\'si geçti' });
      else if (left <= 1000) reasons.push({ level: 'attention', text: `Bakıma ${left} km` });
    }
  }
  const health: Health = reasons.some((r) => r.level === 'critical') ? 'critical' : reasons.length ? 'attention' : 'good';
  return { health, reasons: reasons.map((r) => r.text) };
}

export type CostEntry = { on: string; amount: number; kind: 'fuel' | 'maintenance' };
/** Fuel and maintenance per month (YYYY-MM), oldest first. */
export function monthlyCosts(entries: CostEntry[]) {
  const months = new Map<string, { month: string; fuel: number; maintenance: number }>();
  for (const e of entries) {
    const m = e.on.slice(0, 7);
    const row = months.get(m) ?? { month: m, fuel: 0, maintenance: 0 };
    row[e.kind] = Math.round((row[e.kind] + e.amount) * 100) / 100;
    months.set(m, row);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Cost per km over the readings we have: (fuel + maintenance) ÷ (highest − lowest odometer seen).
 * Null until two readings at least 1 km apart exist.
 */
export function costPerKm(entries: CostEntry[], odometerReadings: number[]) {
  const km = odometerReadings.filter((k) => Number.isFinite(k) && k >= 0);
  if (km.length < 2) return null;
  const distance = Math.max(...km) - Math.min(...km);
  if (distance < 1) return null;
  const total = entries.reduce((s, e) => s + e.amount, 0);
  return Math.round((total / distance) * 100) / 100;
}

/** Average consumption (L/100 km) between full tanks; null when there are not two full fills. */
export function fuelConsumption(fills: Array<{ on: string; liters: number; km: number | null; fullTank: boolean }>) {
  const sorted = fills.filter((f) => f.km !== null).sort((a, b) => (a.km! - b.km!));
  const fullIdx = sorted.map((f, i) => (f.fullTank ? i : -1)).filter((i) => i >= 0);
  if (fullIdx.length < 2) return null;
  const first = fullIdx[0], last = fullIdx[fullIdx.length - 1];
  const liters = sorted.slice(first + 1, last + 1).reduce((s, f) => s + f.liters, 0);
  const km = sorted[last].km! - sorted[first].km!;
  return km > 0 ? Math.round((liters / km) * 1000) / 10 : null;
}

export type Assignment = { id: string; vehicleId: string; startsAt: string; endsAt: string; label: string };
/** Pairs of assignments that put one vehicle in two jobs at once. */
export function assignmentConflicts(list: Assignment[]) {
  const out: Array<{ a: string; b: string; vehicleId: string }> = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.vehicleId === b.vehicleId && Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt)) out.push({ a: a.id, b: b.id, vehicleId: a.vehicleId });
    }
  return out;
}

// Telemetry ---------------------------------------------------------------------------------------

export type RawPosition = { t: string; lat: number; lng: number; speed?: number | null; heading?: number | null; ignition?: boolean | null; odometer?: number | null };
export type Position = { at: string; lat: number; lng: number; speedKmh: number | null; heading: number | null; ignition: boolean | null; odometerKm: number | null };

/**
 * A device point checked: valid coordinates (not 0,0), speed ≤ 300 km/h, heading 0–360, time no
 * more than 5 minutes ahead nor 30 days old. Returns the point or why it was refused.
 */
export function checkPosition(p: RawPosition, now: number): { ok: true; position: Position } | { ok: false; reason: string } {
  const at = Date.parse(p.t);
  if (!Number.isFinite(at)) return { ok: false, reason: 'zaman' };
  if (at > now + 5 * 60_000) return { ok: false, reason: 'gelecek zaman' };
  if (at < now - 30 * DAY) return { ok: false, reason: 'çok eski' };
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180 || (p.lat === 0 && p.lng === 0)) return { ok: false, reason: 'koordinat' };
  if (p.speed !== undefined && p.speed !== null && (!Number.isFinite(p.speed) || p.speed < 0 || p.speed > 300)) return { ok: false, reason: 'hız' };
  if (p.heading !== undefined && p.heading !== null && (!Number.isFinite(p.heading) || p.heading < 0 || p.heading > 360)) return { ok: false, reason: 'yön' };
  if (p.odometer !== undefined && p.odometer !== null && (!Number.isFinite(p.odometer) || p.odometer < 0)) return { ok: false, reason: 'km' };
  return { ok: true, position: { at: new Date(at).toISOString(), lat: p.lat, lng: p.lng, speedKmh: p.speed ?? null, heading: p.heading ?? null, ignition: p.ignition ?? null, odometerKm: p.odometer ?? null } };
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const istanbulDay = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(iso));

/**
 * A route from time-ordered points: distance, stops of at least `minStopMinutes` (the vehicle stays
 * within 100 m, or the ignition is off), and km per Istanbul day. A jump that would need more than
 * 150 km/h, or a gap over 2 hours, is not counted as driven (lost signal, not a trip).
 */
export function routeSummary(points: Position[], minStopMinutes = 5) {
  const pts = [...points].sort((a, b) => a.at.localeCompare(b.at));
  let distanceKm = 0;
  const daily = new Map<string, number>();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const km = haversineKm(a, b);
    const hours = (Date.parse(b.at) - Date.parse(a.at)) / 3_600_000;
    if (hours <= 0 || hours > 2 || km / hours > 150) continue;
    distanceKm += km;
    const d = istanbulDay(b.at);
    daily.set(d, (daily.get(d) ?? 0) + km);
  }
  const stops: Array<{ from: string; to: string; minutes: number; lat: number; lng: number }> = [];
  let i = 0;
  while (i < pts.length) {
    let j = i;
    while (j + 1 < pts.length && (haversineKm(pts[i], pts[j + 1]) <= 0.1 || pts[j + 1].ignition === false)) j++;
    const minutes = Math.round((Date.parse(pts[j].at) - Date.parse(pts[i].at)) / 60_000);
    if (j > i && minutes >= minStopMinutes) stops.push({ from: pts[i].at, to: pts[j].at, minutes, lat: pts[i].lat, lng: pts[i].lng });
    i = j + 1;
  }
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    stops,
    dailyKm: [...daily.entries()].sort().map(([day, km]) => ({ day, km: Math.round(km * 10) / 10 })),
    points: pts.length,
  };
}

/** The cutoff before which positions are deleted (null = keep forever). */
export function retentionCutoff(days: number | null, now: number) {
  return days === null ? null : new Date(now - days * DAY).toISOString();
}

// Map tiles (Web Mercator) -------------------------------------------------------------------------

/** Pixel position of a coordinate at a zoom level (256-px tiles). */
export function project(lat: number, lng: number, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
}

/** The highest zoom (≤ 17) at which all points fit in width × height with a margin. */
export function fitZoom(points: Array<{ lat: number; lng: number }>, width: number, height: number, margin = 40) {
  if (points.length <= 1) return 15;
  for (let z = 17; z >= 2; z--) {
    const px = points.map((p) => project(p.lat, p.lng, z));
    const w = Math.max(...px.map((p) => p.x)) - Math.min(...px.map((p) => p.x));
    const h = Math.max(...px.map((p) => p.y)) - Math.min(...px.map((p) => p.y));
    if (w <= width - 2 * margin && h <= height - 2 * margin) return z;
  }
  return 2;
}
