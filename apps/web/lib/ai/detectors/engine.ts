/**
 * The proactive assistant's rules (pure): what a detector finds (a finding with its evidence pack),
 * whether a finding may be filed now (suppression), and how the queue is ordered. Detectors
 * compute; no model is involved here. No database, no clock: callers pass "now".
 */

export type Priority = 'high' | 'medium' | 'low';
export type Confidence = 'high' | 'medium' | 'low';
export type BadgeTone = 'danger' | 'warning' | 'info' | 'neutral' | 'success';

/** A short fact shown on the card: "3 gün", "2 çubuk eksik", "₺12.400". */
export type Badge = { label: string; tone?: BadgeTone; kind?: 'days' | 'count' | 'money' | 'percent' | 'date' | 'text' };
/** A record the finding rests on (opens from the "Neden?" panel). */
export type EvidenceRecord = { entityType: string; entityId: string; label: string; href?: string };

export type Evidence = {
  badges: Badge[];
  records: EvidenceRecord[];
  /** The numbers behind the finding, by name (shown in "Neden?"). */
  numbers: Record<string, number | string | null>;
};

/** A message the person may copy and send themselves (sending is not connected). */
export type Draft = { channel: 'message'; to: string | null; text: string; tone: 'formal' | 'warm' };

export type Finding<P extends Record<string, unknown> = Record<string, unknown>> = {
  detector: string;
  /** The same underlying situation → the same key, so it is filed once. */
  dedupeKey: string;
  title: string;
  /** One or two plain sentences: why this is on the list. */
  rationale: string;
  priority: Priority;
  confidence: Confidence;
  /** The rule in words, e.g. "Termine ≤ 3 gün kaldı ve aşama 2 gündür ilerlemedi". */
  rule: string;
  evidence: Evidence;
  payload: P;
  draft?: Draft;
};

/** What a firm may change per detector ("bunu X güne çek", aç/kapa, eşik). */
export type DetectorSettings = { enabled: boolean; quietDays: number; threshold?: number };

export type DetectorHistory = {
  /** Dedupe keys of this detector's open suggestions. */
  pending: ReadonlySet<string>;
  /** Rejections of this detector: key, when, and why. */
  rejected: ReadonlyArray<{ dedupeKey: string | null; decidedAt: string; reason: string | null }>;
  /** Approvals: the same situation is not suggested again for the quiet days after it was acted on. */
  approvedKeys?: ReadonlyArray<{ dedupeKey: string | null; decidedAt: string }>;
  /** Decisions so far (approved + rejected): how useful this detector has been. */
  approved: number;
  decided: number;
};

export const DAY_MS = 86_400_000;
/** Below this acceptance rate (after enough decisions) a detector only files its high-priority findings. */
export const THIN_BELOW = 0.2;
export const THIN_MIN_DECISIONS = 8;

export const acceptanceRate = (h: Pick<DetectorHistory, 'approved' | 'decided'>) => (h.decided ? h.approved / h.decided : null);
export const isThinned = (h: Pick<DetectorHistory, 'approved' | 'decided'>) => h.decided >= THIN_MIN_DECISIONS && (acceptanceRate(h) ?? 1) < THIN_BELOW;

export type Suppression = { file: true } | { file: false; reason: 'disabled' | 'open' | 'never' | 'quiet' | 'thinned' };

/**
 * May this finding be filed now? Not when the detector is off, when the same situation is already
 * open, when someone said "bir daha önerme" for it, within the quiet days after a rejection (twice
 * as long for a thinned detector) or after an approval (it was just acted on), or — for a detector
 * people keep rejecting — unless it is urgent.
 */
export function suppression(f: Pick<Finding, 'dedupeKey' | 'priority'>, history: DetectorHistory, settings: DetectorSettings, now: number): Suppression {
  if (!settings.enabled) return { file: false, reason: 'disabled' };
  if (history.pending.has(f.dedupeKey)) return { file: false, reason: 'open' };
  const thinned = isThinned(history);
  const quietMs = settings.quietDays * DAY_MS * (thinned ? 2 : 1);
  for (const r of history.rejected) {
    if (r.dedupeKey !== f.dedupeKey) continue;
    if (r.reason === 'never') return { file: false, reason: 'never' };
    if (now - Date.parse(r.decidedAt) < quietMs) return { file: false, reason: 'quiet' };
  }
  for (const a of history.approvedKeys ?? []) if (a.dedupeKey === f.dedupeKey && now - Date.parse(a.decidedAt) < settings.quietDays * DAY_MS) return { file: false, reason: 'quiet' };
  if (thinned && f.priority !== 'high') return { file: false, reason: 'thinned' };
  return { file: true };
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
/** Queue order: priority, then newest. */
export function compareQueue(a: { priority: Priority; createdAt: string }, b: { priority: Priority; createdAt: string }) {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt.localeCompare(a.createdAt);
}

/** A detector's settings: the firm's saved values over the detector's defaults, clamped. */
export function detectorSettings(defaults: DetectorSettings, saved: Partial<DetectorSettings> | null | undefined): DetectorSettings {
  const quiet = Number(saved?.quietDays);
  const threshold = saved?.threshold === undefined || saved?.threshold === null ? defaults.threshold : Number(saved.threshold);
  return {
    enabled: saved?.enabled === undefined ? defaults.enabled : Boolean(saved.enabled),
    quietDays: Number.isFinite(quiet) && quiet >= 0 ? Math.min(365, Math.round(quiet)) : defaults.quietDays,
    ...(threshold === undefined || !Number.isFinite(threshold) ? {} : { threshold }),
  };
}

/** Pending findings whose situation is gone (not found this run) are closed as expired. */
export const resolvedKeys = (pending: ReadonlySet<string>, found: ReadonlyArray<Pick<Finding, 'dedupeKey'>>) => {
  const now = new Set(found.map((f) => f.dedupeKey));
  return [...pending].filter((k) => !now.has(k));
};

// Formatting helpers for evidence badges (Turkish) ---------------------------------------------

export const tl = (n: number) => `₺${Math.round(n).toLocaleString('tr-TR')}`;
export const daysBadge = (n: number, suffix = 'gün', tone: BadgeTone = 'warning'): Badge => ({ label: `${n} ${suffix}`, tone, kind: 'days' });
export const moneyBadge = (n: number, tone: BadgeTone = 'neutral'): Badge => ({ label: tl(n), tone, kind: 'money' });
export const countBadge = (n: number, what: string, tone: BadgeTone = 'warning'): Badge => ({ label: `${n.toLocaleString('tr-TR')} ${what}`, tone, kind: 'count' });

/** Calendar days between two ISO days (to − from). */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10) + 'T00:00:00Z') - Date.parse(from.slice(0, 10) + 'T00:00:00Z')) / DAY_MS);
export const addDays = (d: string, n: number) => new Date(Date.parse(d.slice(0, 10) + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
