import {
  normalizeBlockedReasonCategory,
  normalizeBlockedReasonDetail,
  validateBlockedReasonForStatus,
} from '../blocked-reason';

describe('work order blocked reason validation', () => {
  it('normalizes valid categories', () => {
    expect(normalizeBlockedReasonCategory(' MACHINE ')).toBe('machine');
    expect(normalizeBlockedReasonCategory('')).toBeNull();
    expect(normalizeBlockedReasonCategory('invalid')).toBeNull();
  });

  it('normalizes detail values', () => {
    expect(normalizeBlockedReasonDetail('  waiting for raw material  ')).toBe(
      'waiting for raw material'
    );
    expect(normalizeBlockedReasonDetail('   ')).toBeNull();
  });

  it('requires category and detail when status is blocked', () => {
    expect(() => validateBlockedReasonForStatus('blocked', null, 'abcde')).toThrow(
      'kategorisi zorunludur'
    );
    expect(() => validateBlockedReasonForStatus('blocked', 'machine', 'abc')).toThrow(
      'en az 5 karakter'
    );
    expect(() => validateBlockedReasonForStatus('blocked', 'machine', 'line jam')).not.toThrow();
  });

  it('does not require reason when status is not blocked', () => {
    expect(() => validateBlockedReasonForStatus('in_progress', null, null)).not.toThrow();
  });
});
