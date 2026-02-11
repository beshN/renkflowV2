import {
  canTransitionWorkOrderStatus,
  isWorkOrderTerminalStatus,
} from '../status';

describe('work order status transitions', () => {
  it('allows configured forward transitions', () => {
    expect(canTransitionWorkOrderStatus('open', 'in_progress')).toBe(true);
    expect(canTransitionWorkOrderStatus('in_progress', 'done')).toBe(true);
    expect(canTransitionWorkOrderStatus('blocked', 'in_progress')).toBe(true);
  });

  it('blocks invalid transitions', () => {
    expect(canTransitionWorkOrderStatus('open', 'done')).toBe(false);
    expect(canTransitionWorkOrderStatus('blocked', 'done')).toBe(false);
    expect(canTransitionWorkOrderStatus('cancelled', 'done')).toBe(false);
  });

  it('allows no-op transitions', () => {
    expect(canTransitionWorkOrderStatus('open', 'open')).toBe(true);
    expect(canTransitionWorkOrderStatus('done', 'done')).toBe(true);
  });

  it('marks terminal statuses correctly', () => {
    expect(isWorkOrderTerminalStatus('done')).toBe(true);
    expect(isWorkOrderTerminalStatus('cancelled')).toBe(true);
    expect(isWorkOrderTerminalStatus('in_progress')).toBe(false);
  });
});
