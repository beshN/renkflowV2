import { normalizeOrderStatus } from './workspace';
import { ORDER_TRANSITIONS } from './transition-rules';

/**
 * The six steps a customer order goes through, as the workshop talks about them. Each order
 * status falls in one step; the strip on every order card and the kanban columns use this.
 */
export const LIFECYCLE = [
  { key: 'quote', label: 'Teklif', statuses: ['new'] },
  { key: 'approval', label: 'Onay', statuses: ['pending_approval', 'approved'] },
  { key: 'production', label: 'Üretim', statuses: ['preparing_materials', 'ready_for_production'] },
  { key: 'cutting', label: 'Kesim', statuses: ['in_production'] },
  { key: 'assembly', label: 'Montaj', statuses: ['quality_check', 'ready_for_shipment'] },
  { key: 'delivery', label: 'Teslim', statuses: ['shipped', 'completed'] },
] as const;
export type LifecycleKey = (typeof LIFECYCLE)[number]['key'];

/** Step index 0–5; -1 for an order on hold or cancelled (shown apart, not on the strip). */
export function lifecycleIndex(status: string): number {
  const s = normalizeOrderStatus(status);
  return LIFECYCLE.findIndex((step) => (step.statuses as readonly string[]).includes(s));
}

/** True once the order has passed its last step. */
export const isDelivered = (status: string) => normalizeOrderStatus(status) === 'completed';

/**
 * The moves that take an order onto a step when it is dropped there: the shortest chain of allowed
 * transitions (at most three, never through hold or cancel) ending in a status of that step, e.g.
 * "onay bekliyor" → "onaylandı" → "malzeme hazırlığı". Each move is still checked by the server.
 * Null when the step cannot be reached that way (a jump over several steps, or backwards).
 */
export function dropPath(status: string, step: LifecycleKey, maxMoves = 3): string[] | null {
  const from = normalizeOrderStatus(status);
  const target = LIFECYCLE.find((s) => s.key === step);
  if (!target || (target.statuses as readonly string[]).includes(from)) return null;
  const goal = new Set<string>(target.statuses);
  let frontier: string[][] = [[from]];
  const seen = new Set([from]);
  for (let depth = 0; depth < maxMoves; depth++) {
    const next: string[][] = [];
    for (const path of frontier) {
      for (const to of ORDER_TRANSITIONS[path[path.length - 1]] ?? []) {
        if (seen.has(to) || to === 'cancelled' || to === 'on_hold') continue;
        const chain = [...path, to];
        if (goal.has(to)) return chain.slice(1);
        seen.add(to);
        next.push(chain);
      }
    }
    frontier = next;
  }
  return null;
}

/** The status an order ends in when dropped on a step, or null when it cannot get there. */
export const dropTarget = (status: string, step: LifecycleKey) => dropPath(status, step)?.at(-1) ?? null;

export type HealthInput = { status: string; deliveryDate?: string | null; createdAt?: string | null; date?: string | null };
export type Health = { level: 'good' | 'watch' | 'risk' | 'late' | 'done'; daysLeft: number | null; score: number };

const DAY = 86_400_000;
const dayNumber = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') / DAY);

/**
 * Order health: how likely the order is to miss its date. Compares how much of the way it has
 * come (lifecycle step) with how much of the time between order and delivery date has passed.
 * Deterministic and explainable: no model, no hidden data.
 */
export function orderHealth(order: HealthInput, today: string): Health {
  const step = lifecycleIndex(order.status);
  if (isDelivered(order.status) || normalizeOrderStatus(order.status) === 'cancelled') return { level: 'done', daysLeft: null, score: 100 };
  if (!order.deliveryDate) return { level: 'watch', daysLeft: null, score: 60 };
  const daysLeft = dayNumber(order.deliveryDate) - dayNumber(today);
  if (daysLeft < 0 && normalizeOrderStatus(order.status) !== 'shipped') return { level: 'late', daysLeft, score: 0 };
  const start = order.createdAt || order.date || today;
  const span = Math.max(1, dayNumber(order.deliveryDate) - dayNumber(start));
  const timeUsed = Math.min(1, Math.max(0, (span - Math.max(0, daysLeft)) / span));
  const progress = step < 0 ? 0 : step / (LIFECYCLE.length - 1);
  // Behind by more than a third of the way, or two days left and not yet at assembly: at risk.
  const gap = timeUsed - progress;
  const score = Math.round(Math.max(0, Math.min(100, 100 - gap * 120)));
  const level = (daysLeft <= 2 && step < 4) || gap > 0.35 ? 'risk' : gap > 0.15 ? 'watch' : 'good';
  return { level, daysLeft, score };
}
