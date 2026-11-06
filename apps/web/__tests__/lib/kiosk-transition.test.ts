import { OperationCommandSchema, transitionOperation } from '@/lib/features/manufacturing/platform-contract';
const now = new Date('2026-01-01T00:01:00Z');
const state = { status: 'ready' as const, plannedQty: 2, completedQty: 0, activeSeconds: 0, activeSince: null };
const command = (action: 'start' | 'pause' | 'complete') => OperationCommandSchema.parse({ operationId: '00000000-0000-4000-8000-000000000001', version: 1, action, quantity: 2 });
it('reuses the production clock across start, pause, resume and complete', () => {
  const started = transitionOperation(state, command('start'), new Date('2026-01-01T00:00:00Z'));
  const paused = transitionOperation(started, command('pause'), now);
  expect(paused.activeSeconds).toBe(60);
  const resumed = transitionOperation(paused, command('start'), new Date('2026-01-01T00:02:00Z'));
  const done = transitionOperation(resumed, command('complete'), new Date('2026-01-01T00:03:00Z'));
  expect(done.status).toBe('done'); expect(done.activeSeconds).toBe(120);
});
it.each(['done','cancelled','running','waiting'] as const)('refuses start from %s', status => {
  expect(() => transitionOperation({ ...state, status }, command('start'), now)).toThrow();
});
it('refuses pause and complete before starting', () => {
  for (const action of ['pause','complete'] as const) expect(() => transitionOperation(state, command(action), now)).toThrow();
});
