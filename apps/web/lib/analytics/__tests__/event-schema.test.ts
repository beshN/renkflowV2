import {
  ANALYTICS_EVENTS,
  buildAnalyticsEventPayload,
  ONBOARDING_STEP_KEYS,
} from '../event-schema';

describe('analytics event schema', () => {
  it('contains required onboarding and support events', () => {
    expect(ANALYTICS_EVENTS.onboardingStepCompleted).toBe('onboarding.step_completed');
    expect(ANALYTICS_EVENTS.onboardingActivated).toBe('onboarding.activated');
    expect(ANALYTICS_EVENTS.supportTicketCreated).toBe('support.ticket_created');
  });

  it('defines stable onboarding step keys', () => {
    expect(ONBOARDING_STEP_KEYS).toEqual([
      'tenant_profile',
      'workstation_setup',
      'first_order_created',
      'first_operator_invited',
      'first_work_order_assigned',
    ]);
  });

  it('injects createdAt when absent', () => {
    const payload = buildAnalyticsEventPayload({
      tenantId: 'tenant-1',
      userId: 'user-1',
      event: ANALYTICS_EVENTS.workOrderCreated,
    });
    expect(payload.createdAt).toBeDefined();
  });
});
