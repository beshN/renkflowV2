/**
 * Sales-to-service chain rules (pure): the lead pipeline, survey measures, installation planning
 * and warranty. The server applies them; the screens show the same answers.
 */
import { productFamily } from '@/lib/features/products/families';

// Leads ------------------------------------------------------------------------------------------

export const LEAD_STAGES = ['new', 'survey', 'quoted', 'negotiation', 'won', 'lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'Yeni', survey: 'Keşif', quoted: 'Teklif', negotiation: 'Pazarlık', won: 'Kazanıldı', lost: 'Kaybedildi',
};
export const LEAD_SOURCES = ['referral', 'web', 'phone', 'showroom', 'fair', 'social', 'dealer', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  referral: 'Referans', web: 'Web sitesi', phone: 'Telefon', showroom: 'Showroom', fair: 'Fuar', social: 'Sosyal medya', dealer: 'Bayi', other: 'Diğer',
};
export const LOST_REASONS = ['price', 'competitor', 'timing', 'no_answer', 'postponed', 'not_feasible', 'other'] as const;
export type LostReason = (typeof LOST_REASONS)[number];
export const LOST_REASON_LABELS: Record<LostReason, string> = {
  price: 'Fiyat yüksek', competitor: 'Rakibi seçti', timing: 'Termin uymadı', no_answer: 'Dönüş yok', postponed: 'Erteledi', not_feasible: 'Teknik olarak uygun değil', other: 'Diğer',
};

/** Where a lead may go next. A lost lead can be reopened; a won lead is final (it became a customer). */
export const LEAD_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  new: ['survey', 'quoted', 'lost'],
  survey: ['quoted', 'new', 'lost'],
  quoted: ['negotiation', 'won', 'lost', 'survey'],
  negotiation: ['won', 'lost', 'quoted'],
  won: [],
  lost: ['new'],
};

/** Why a stage change is refused (null when allowed); losing needs a reason. */
export function leadStageProblem(from: LeadStage, to: LeadStage, lostReason?: string | null) {
  if (from === to) return null;
  if (!LEAD_TRANSITIONS[from]?.includes(to)) return `${LEAD_STAGE_LABELS[from]} aşamasından ${LEAD_STAGE_LABELS[to]} aşamasına geçilemez`;
  if (to === 'lost' && !(LOST_REASONS as readonly string[]).includes(lostReason ?? '')) return 'Kayıp nedeni seçin';
  return null;
}

export type LeadRow = { source: string; stage: LeadStage; createdAt: string; closedAt: string | null };

/**
 * Conversion by source: won ÷ (won + lost) of the leads closed, open leads counted apart, and the
 * average days from first contact to a win. Leads created in [from, to) are counted.
 */
export function conversionReport(leads: LeadRow[], from?: string, to?: string) {
  const inRange = leads.filter((l) => (!from || l.createdAt.slice(0, 10) >= from) && (!to || l.createdAt.slice(0, 10) < to));
  const day = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z');
  const group = (rows: LeadRow[]) => {
    const won = rows.filter((l) => l.stage === 'won');
    const lost = rows.filter((l) => l.stage === 'lost').length;
    const closed = won.length + lost;
    const days = won.filter((l) => l.closedAt).map((l) => Math.max(0, Math.round((day(l.closedAt!) - day(l.createdAt)) / 86_400_000)));
    return {
      total: rows.length, open: rows.length - closed, won: won.length, lost,
      conversionPct: closed ? Math.round((won.length / closed) * 100) : null,
      avgDaysToWin: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    };
  };
  const sources = [...new Set(inRange.map((l) => l.source))].sort();
  return {
    overall: group(inRange),
    bySource: sources.map((source) => ({ source, ...group(inRange.filter((l) => l.source === source)) })),
    funnel: LEAD_STAGES.map((stage) => ({ stage, count: inRange.filter((l) => l.stage === stage).length })),
  };
}

// Survey measures --------------------------------------------------------------------------------

export type MeasureField = { key: string; label: string; type: 'mm' | 'number' | 'choice' | 'yesno' | 'text'; options?: string[]; required?: boolean };

const GENERIC_FIELDS: MeasureField[] = [
  { key: 'widthMm', label: 'En (mm)', type: 'mm', required: true },
  { key: 'heightMm', label: 'Yükseklik (mm)', type: 'mm', required: true },
];
/** Site facts a survey notes beyond the product's own measures. */
const SITE_FIELDS: Record<string, MeasureField[]> = {
  pergola: [
    { key: 'postCount', label: 'Ayak sayısı', type: 'number' },
    { key: 'mounting', label: 'Montaj', type: 'choice', options: ['Duvara', 'Serbest duran'] },
    { key: 'ground', label: 'Zemin', type: 'choice', options: ['Beton', 'Seramik', 'Ahşap', 'Toprak'] },
    { key: 'motorSide', label: 'Motor yönü', type: 'choice', options: ['Sağ', 'Sol'] },
    { key: 'power', label: 'Elektrik hattı var', type: 'yesno' },
    { key: 'drainage', label: 'Su tahliyesi', type: 'text' },
  ],
};

/** The measure form for a product family: its own dimensions, then the site facts. */
export function measureFields(familyKey: string | null | undefined): MeasureField[] {
  const family = familyKey ? productFamily(familyKey) : null;
  const own: MeasureField[] = family ? family.dimensions.map((d) => ({ key: d.key, label: d.label, type: 'mm', required: true })) : GENERIC_FIELDS;
  return [...own, ...(SITE_FIELDS[familyKey ?? ''] ?? [])];
}

export type Measures = Record<string, string | number | boolean | null>;

/** Problems with a measure form: missing required values, non-positive or implausible millimetres. */
export function measureProblems(familyKey: string | null | undefined, values: Measures) {
  const problems: string[] = [];
  for (const f of measureFields(familyKey)) {
    const v = values[f.key];
    const empty = v === undefined || v === null || v === '';
    if (f.required && empty) problems.push(`${f.label} girilmeli`);
    if (!empty && (f.type === 'mm' || f.type === 'number')) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) problems.push(`${f.label} sıfırdan büyük bir sayı olmalı`);
      else if (f.type === 'mm' && n > 30_000) problems.push(`${f.label} 30 metreyi aşamaz`);
    }
    if (!empty && f.type === 'choice' && f.options && !f.options.includes(String(v))) problems.push(`${f.label} için geçersiz seçim`);
  }
  return problems;
}

/** Only the known fields, as numbers where they are numbers (what is stored). */
export function cleanMeasures(familyKey: string | null | undefined, values: Measures): Measures {
  const out: Measures = {};
  for (const f of measureFields(familyKey)) {
    const v = values[f.key];
    if (v === undefined || v === null || v === '') continue;
    out[f.key] = f.type === 'mm' || f.type === 'number' ? Number(v) : f.type === 'yesno' ? v === true || v === 'true' : String(v).trim().slice(0, 300);
  }
  return out;
}

/** What changed in the measures since the quote was made (each field with before and after). */
export function measureDiff(familyKey: string | null | undefined, atQuote: Measures, now: Measures) {
  return measureFields(familyKey)
    .filter((f) => (atQuote[f.key] ?? null) !== (now[f.key] ?? null))
    .map((f) => ({ key: f.key, label: f.label, before: atQuote[f.key] ?? null, after: now[f.key] ?? null }));
}

// Installations ----------------------------------------------------------------------------------

export const INSTALLATION_STATUSES = ['planned', 'in_progress', 'done', 'cancelled'] as const;
export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];
export const INSTALLATION_STATUS_LABELS: Record<InstallationStatus, string> = { planned: 'Planlandı', in_progress: 'Sahada', done: 'Tamamlandı', cancelled: 'İptal' };
export const DEFAULT_INSTALL_CHECKLIST = [
  'Ölçüler sahada kontrol edildi',
  'Ankraj ve ayak bağlantıları yapıldı',
  'Su tahliyesi denendi',
  'Motor ve kumanda denendi',
  'Saha temizlendi',
  'Müşteriye kullanım anlatıldı',
];

export type PlannedInstallation = { id: string; date: string; startMinute: number; durationMinutes: number; crew: string[]; status: InstallationStatus; label: string };

/**
 * Pairs of installations that put the same person in two places at once on the same day.
 * Cancelled and finished ones do not count. Each pair is reported once with who overlaps.
 */
export function installationConflicts(list: PlannedInstallation[]) {
  const live = list.filter((i) => i.status === 'planned' || i.status === 'in_progress');
  const out: Array<{ a: string; b: string; people: string[]; date: string }> = [];
  for (let x = 0; x < live.length; x++) {
    for (let y = x + 1; y < live.length; y++) {
      const a = live[x], b = live[y];
      if (a.date !== b.date) continue;
      const overlap = a.startMinute < b.startMinute + b.durationMinutes && b.startMinute < a.startMinute + a.durationMinutes;
      const people = a.crew.filter((p) => b.crew.includes(p));
      if (overlap && people.length) out.push({ a: a.id, b: b.id, people, date: a.date });
    }
  }
  return out;
}

/** "09:30" → minutes from midnight; null when not a time. */
export function minuteOf(time: string | null | undefined) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Warranty and service ---------------------------------------------------------------------------

export const DEFAULT_WARRANTY_MONTHS = 24;

/** Warranty from the delivery day for `months`: whether `today` is still covered and until when. */
export function warrantyStatus(deliveredOn: string | null | undefined, months: number, today: string) {
  if (!deliveredOn) return { covered: false, endsOn: null as string | null, daysLeft: null as number | null, reason: 'Teslim tarihi yok' };
  const d = new Date(deliveredOn.slice(0, 10) + 'T00:00:00Z');
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  // A day that does not exist in the end month (31 Jan + 1 month) falls back to that month's last day.
  if (end.getUTCDate() !== d.getUTCDate()) end.setUTCDate(0);
  const endsOn = end.toISOString().slice(0, 10);
  const daysLeft = Math.round((Date.parse(endsOn + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86_400_000);
  return { covered: daysLeft >= 0, endsOn, daysLeft, reason: daysLeft >= 0 ? null : 'Garanti süresi doldu' };
}

export const TICKET_CATEGORIES = ['leak', 'motor', 'fabric', 'led', 'mechanical', 'paint', 'glass', 'other'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  leak: 'Su sızıntısı', motor: 'Motor / kumanda', fabric: 'Kumaş / örtü', led: 'Aydınlatma', mechanical: 'Mekanik / bağlantı', paint: 'Boya / yüzey', glass: 'Cam', other: 'Diğer',
};
export const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = { open: 'Açık', assigned: 'Atandı', in_progress: 'Üzerinde çalışılıyor', resolved: 'Çözüldü', closed: 'Kapandı' };
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ['assigned', 'in_progress', 'resolved'],
  assigned: ['in_progress', 'resolved', 'open'],
  in_progress: ['resolved', 'assigned'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

/** Why a ticket status change is refused (resolving needs a written resolution). */
export function ticketStatusProblem(from: TicketStatus, to: TicketStatus, resolution?: string | null) {
  if (from === to) return null;
  if (!TICKET_TRANSITIONS[from]?.includes(to)) return `${TICKET_STATUS_LABELS[from]} durumundan ${TICKET_STATUS_LABELS[to]} durumuna geçilemez`;
  if (to === 'resolved' && (resolution ?? '').trim().length < 3) return 'Çözümü yazın';
  return null;
}

export type TicketRow = { id: string; orderId: string | null; category: string; family: string | null; openedAt: string; resolvedAt: string | null };

/**
 * Service report: average and slowest resolution in hours, open count, and recurring issues — the
 * same category on the same product family, or the same order, coming back at least twice.
 */
export function serviceReport(tickets: TicketRow[]) {
  const hours = tickets.filter((t) => t.resolvedAt).map((t) => Math.max(0, (Date.parse(t.resolvedAt!) - Date.parse(t.openedAt)) / 3_600_000));
  const count = <K extends string>(key: (t: TicketRow) => K | null) => {
    const m = new Map<K, TicketRow[]>();
    for (const t of tickets) { const k = key(t); if (k) m.set(k, [...(m.get(k) ?? []), t]); }
    return m;
  };
  const byCategory = [...count((t) => `${t.category}|${t.family ?? ''}`)].filter(([, list]) => list.length >= 2)
    .map(([k, list]) => ({ category: k.split('|')[0], family: k.split('|')[1] || null, count: list.length }))
    .sort((a, b) => b.count - a.count);
  const byOrder = [...count((t) => t.orderId)].filter(([, list]) => list.length >= 2).map(([orderId, list]) => ({ orderId, count: list.length })).sort((a, b) => b.count - a.count);
  return {
    total: tickets.length,
    open: tickets.filter((t) => !t.resolvedAt).length,
    avgResolutionHours: hours.length ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : null,
    maxResolutionHours: hours.length ? Math.round(Math.max(...hours) * 10) / 10 : null,
    recurring: { byCategory, byOrder },
  };
}

/** A map link for an address (OpenStreetMap search; nothing is sent until the person clicks). */
export function mapLink(address: string | null | undefined) {
  const a = (address ?? '').trim();
  return a ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(a)}` : null;
}
