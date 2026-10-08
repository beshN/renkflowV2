import { activityState, checklistPercent, mentionIds, plainMentions } from '@/lib/features/records/types';

describe('record platform helpers', () => {
  const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
  it('reads mentions only from composer tokens, each person once', () => {
    expect(mentionIds(`@[Ayşe](${a}) ölçüyü kontrol et, @[Ayşe](${a}) ve @[Mehmet Usta](${b.toUpperCase()})`)).toEqual([a, b]);
    expect(mentionIds('@Ayşe düz metin, e-posta ali@firma.com')).toEqual([]);
    expect(mentionIds(`@[x](not-a-uuid)`)).toEqual([]);
  });
  it('shows mentions as names', () => {
    expect(plainMentions(`@[Ayşe](${a}) bak`)).toBe('@Ayşe bak');
  });
  it('gives checklist progress as a whole percentage', () => {
    expect(checklistPercent([])).toBe(0);
    expect(checklistPercent([{ done: true }, { done: false }, { done: false }])).toBe(33);
    expect(checklistPercent([{ done: true }, { done: true }])).toBe(100);
  });
  it('tells an activity apart as overdue, today, planned or done', () => {
    expect(activityState('2026-10-07', '2026-10-08', false)).toBe('overdue');
    expect(activityState('2026-10-08', '2026-10-08', false)).toBe('today');
    expect(activityState('2026-10-09', '2026-10-08', false)).toBe('planned');
    expect(activityState('2026-10-07', '2026-10-08', true)).toBe('done');
  });
});
