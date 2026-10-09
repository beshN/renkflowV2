/**
 * Which order status may follow which, when a person moves an order by hand. Shared by the server
 * (which enforces it) and the screens (which only offer moves it allows).
 */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  new: ["pending_approval", "approved", "cancelled"],
  pending: ["pending_approval", "approved", "cancelled"],
  pending_approval: ["approved", "cancelled", "on_hold"],
  approved: ["preparing_materials", "cancelled", "on_hold"],
  preparing_materials: ["ready_for_production", "on_hold"],
  ready_for_production: ["in_production", "on_hold"],
  in_production: ["quality_check", "ready_for_shipment", "on_hold"],
  quality_check: ["ready_for_shipment", "in_production"],
  ready: ["shipped", "delivered"],
  ready_for_shipment: ["shipped", "delivered"],
  shipped: ["completed", "delivered"],
  delivered: ["completed"],
  on_hold: [
    "approved",
    "preparing_materials",
    "ready_for_production",
    "in_production",
    "cancelled",
  ],
  completed: [],
  cancelled: [],
};

export const canTransition = (from: string, to: string) => (ORDER_TRANSITIONS[from] ?? []).includes(to);

/** Moves that need a written reason: stopping, cancelling or sending work back a step. */
export function transitionNeedsReason(from: string, to: string) {
  return to === "cancelled" || to === "on_hold" || (from === "quality_check" && to === "in_production");
}

/** Why a move is refused (null when allowed): the shared rule every status path enforces. */
export function transitionProblem(from: string, to: string, note: string | null | undefined) {
  if (from === to) return null;
  if (!canTransition(from, to)) return "Bu durum geçişine izin verilmiyor";
  if (transitionNeedsReason(from, to) && (note ?? "").trim().length < 3) return "Bu geçiş için gerekçe yazın";
  return null;
}
