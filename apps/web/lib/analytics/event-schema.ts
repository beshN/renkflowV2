export const ANALYTICS_EVENTS = {
  onboardingStepCompleted: 'onboarding.step_completed',
  onboardingActivated: 'onboarding.activated',
  supportTicketCreated: 'support.ticket_created',
  workOrderCreated: 'work_order.created',
  workOrderUpdated: 'work_order.updated',
  workOrderCommentAdded: 'work_order.comment_added',
  workOrderChecklistToggled: 'work_order.checklist_toggled',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export const ONBOARDING_STEP_KEYS = [
  'tenant_profile',
  'workstation_setup',
  'first_order_created',
  'first_operator_invited',
  'first_work_order_assigned',
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

export type AnalyticsEventPayload = {
  tenantId: string;
  userId: string;
  event: AnalyticsEventName;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export function buildAnalyticsEventPayload(input: AnalyticsEventPayload): AnalyticsEventPayload {
  return {
    ...input,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}
