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
