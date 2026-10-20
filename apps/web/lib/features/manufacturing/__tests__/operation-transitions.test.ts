/**
 * @jest-environment node
 *
 * State machine of a production operation (transitionOperation) — the gate every worker command
 * (start / pause / complete / note / rework) passes through before platform.service writes a row.
 *
 * Proven invariants:
 *  - a stage can only start from ready/paused/blocked: a running or done operation cannot be
 *    started a second time (double execution guard),
 *  - only a running operation can pause or complete (complete without start is refused),
 *  - partial completion stops at 'paused', the full quantity reaches 'done',
 *  - overproduction past planned quantity is refused,
 *  - working seconds accrue from active_since and are clamped when the clock moves backwards,
 *  - rework and note commands carry the mandatory evidence the shop floor must record.
 */
import { OperationCommandSchema, transitionOperation, type OperationStateSchema } from '../platform-contract';
import { z } from 'zod';

type State = z.infer<typeof OperationStateSchema>;
const OP = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';

const state = (overrides: Partial<State> = {}): State => ({
  status: 'running',
  plannedQty: 10,
  completedQty: 0,
  activeSeconds: 60,
  activeSince: '2026-10-05T08:00:00.000Z',
  ...overrides,
});

const command = (action: 'start' | 'pause' | 'complete' | 'note' | 'rework', extra: Record<string, unknown> = {}) =>
  OperationCommandSchema.parse({ operationId: OP, version: 1, action, ...extra });

// One minute after active_since: every running transition must add exactly these 60 seconds.
const NOW = new Date('2026-10-05T08:01:00.000Z');

describe('stage transitions', () => {
  it('starts only from ready, paused or blocked and accrues the running clock', () => {
    for (const status of ['ready', 'paused', 'blocked'] as const) {
      const result = transitionOperation(state({ status, activeSeconds: 60, activeSince: null }), command('start'), NOW);
      expect(result).toMatchObject({ status: 'running', activeSeconds: 60, activeSince: NOW.toISOString() });
    }
    // A blocked operation keeps the seconds it had and starts a fresh interval.
    const fromBlocked = transitionOperation(state({ status: 'blocked', activeSeconds: 120, activeSince: null }), command('start'), NOW);
    expect(fromBlocked.activeSeconds).toBe(120);
  });

  it.each(['waiting', 'running', 'done', 'cancelled'] as const)('refuses to start a %s operation again', (status) => {
    expect(() => transitionOperation(state({ status }), command('start'), NOW)).toThrow('başlatılamaz');
  });

  it('pauses only a running operation and clears the running interval', () => {
    const paused = transitionOperation(state(), command('pause'), NOW);
    expect(paused).toMatchObject({ status: 'paused', activeSeconds: 120, activeSince: null });
    for (const status of ['ready', 'paused', 'blocked', 'done', 'cancelled'] as const) {
      expect(() => transitionOperation(state({ status, activeSince: null }), command('pause'), NOW)).toThrow('duraklatılabilir');
    }
  });

  it('records partial production and stops at paused', () => {
    const result = transitionOperation(state(), command('complete', { quantity: 4 }), NOW);
    expect(result).toMatchObject({ status: 'paused', completedQty: 4, activeSeconds: 120, activeSince: null });
    expect(result.completedQty).toBeLessThan(result.plannedQty);
  });

  it('completes only when the full quantity is reached', () => {
    const done = transitionOperation(state(), command('complete', { quantity: 10 }), NOW);
    expect(done).toMatchObject({ status: 'done', completedQty: 10 });
    // Exactly the remaining quantity finishes too.
    const remainder = transitionOperation(state({ completedQty: 7, activeSeconds: 0, activeSince: null }), command('complete', { quantity: 3 }), NOW);
    expect(remainder).toMatchObject({ status: 'done', completedQty: 10 });
  });

  it('refuses overproduction, a missing quantity and completing without running', () => {
    expect(() => transitionOperation(state(), command('complete', { quantity: 11 }), NOW)).toThrow('aşamaz');
    expect(() => transitionOperation(state({ completedQty: 9 }), command('complete', { quantity: 2 }), NOW)).toThrow('aşamaz');
    // No quantity at all is treated as no production: the same guard fires.
    expect(() => transitionOperation(state(), command('complete'), NOW)).toThrow('aşamaz');
    // A paused operation cannot be completed again — start it first.
    expect(() => transitionOperation(state({ status: 'paused' }), command('complete', { quantity: 1 }), NOW)).toThrow('başlatın');
    // A done operation is terminal for completion: the double execution is refused.
    expect(() => transitionOperation(state({ status: 'done', completedQty: 10 }), command('complete', { quantity: 1 }), NOW)).toThrow('başlatın');
    // Non-positive or fractional quantities never reach the state machine.
    for (const quantity of [0, -1, 1.5]) {
      expect(OperationCommandSchema.safeParse({ operationId: OP, version: 1, action: 'complete', quantity }).success).toBe(false);
    }
  });

  it('keeps the running clock untouched while a note is added, and demands evidence', () => {
    const running = state();
    expect(() => transitionOperation(running, command('note'), NOW)).toThrow('gerekli');
    const noted = transitionOperation(running, command('note', { reason: 'Makine bakımı' }), NOW);
    expect(noted).toEqual(running); // a note never advances seconds nor changes the stage
    const withPhoto = transitionOperation(running, command('note', { photos: ['/api/v1/production/files/x/y.jpg'] }), NOW);
    expect(withPhoto.status).toBe('running');
  });

  it('does not lose working time when the clock reports a moment before active_since', () => {
    const skewed = transitionOperation(state({ activeSince: '2026-10-05T08:05:00.000Z' }), command('pause'), NOW);
    expect(skewed.activeSeconds).toBe(60); // clamped at zero instead of subtracting
    expect(skewed.status).toBe('paused');
  });

  it('keeps rework on the running clock and demands reason, code, target and quantity', () => {
    const base = { operationId: OP, version: 1, action: 'rework', reason: 'Ölçü hatası', reasonCode: 'measurement', targetOperationId: TARGET, quantity: 2 };
    for (const missing of ['reason', 'reasonCode', 'targetOperationId', 'quantity']) {
      const payload: Record<string, unknown> = { ...base };
      delete payload[missing];
      // The schema keeps them optional, so the guard lives in the state machine itself.
      expect(() => transitionOperation(state(), OperationCommandSchema.parse(payload), NOW)).toThrow('gerekli');
    }
    // With everything present the state machine hands the work back without changing the stage;
    // platform.service performs the actual rollback of the affected operations.
    const complete = transitionOperation(state(), OperationCommandSchema.parse(base), NOW);
    expect(complete).toMatchObject({ status: 'running', completedQty: 0, activeSeconds: 120, activeSince: null });
  });

  it('rejects unknown commands and impossible versions before touching the state', () => {
    expect(OperationCommandSchema.safeParse({ operationId: OP, version: 1, action: 'force' }).success).toBe(false);
    expect(OperationCommandSchema.safeParse({ operationId: OP, version: 0, action: 'start' }).success).toBe(false);
    expect(OperationCommandSchema.safeParse({ operationId: 'not-a-uuid', version: 1, action: 'start' }).success).toBe(false);
  });

  it('names the stages the shop floor knows (Turkish copy stays in place)', () => {
    expect(() => transitionOperation(state({ status: 'waiting' }), command('start'), NOW)).toThrow('başlatılamaz');
    expect(() => transitionOperation(state(), command('pause'), NOW)).not.toThrow();
    expect(() => transitionOperation(state({ status: 'paused' }), command('pause'), NOW)).toThrow('Yalnız');
  });
});
