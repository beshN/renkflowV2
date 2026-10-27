import { milestoneOrdinal, milestoneStorageKey, milestoneToShow } from '@/lib/spells/milestones';
import { isLateNight, istanbulHour } from '@/lib/spells/late-night';
import { createRapidClickCounter } from '@/lib/spells/rapid-clicks';

describe('milestoneToShow', () => {
  it('shows nothing below the first milestone or without a count', () => {
    expect(milestoneToShow(9, [])).toBeNull();
    expect(milestoneToShow(null, [])).toBeNull();
    expect(milestoneToShow(Number.NaN, [])).toBeNull();
  });

  it('shows the milestone just reached', () => {
    expect(milestoneToShow(10, [])).toBe(10);
    expect(milestoneToShow(100, [10])).toBe(100);
    expect(milestoneToShow(1000, [10, 100])).toBe(1000);
    expect(milestoneToShow(10000, [10, 100, 1000])).toBe(10000);
  });

  it('shows only the highest when several were passed before', () => {
    expect(milestoneToShow(2500, [])).toBe(1000);
    expect(milestoneToShow(250000, [])).toBe(10000);
  });

  it('shows each milestone once', () => {
    expect(milestoneToShow(150, [100])).toBeNull();
    expect(milestoneToShow(150, [1000])).toBeNull();
    expect(milestoneToShow(1001, [100])).toBe(1000);
  });

  it('formats keys and ordinals', () => {
    expect(milestoneStorageKey('t-1', 1000)).toBe('renkflow.milestone.t-1.1000');
    expect(milestoneOrdinal(1000)).toBe('1.000.');
    expect(milestoneOrdinal(10000)).toBe('10.000.');
    expect(milestoneOrdinal(10)).toBe('10.');
  });
});

describe('isLateNight (Europe/Istanbul, UTC+3)', () => {
  const at = (utc: string) => new Date(utc);
  it('starts at 00:00 Istanbul', () => {
    expect(isLateNight(at('2026-10-26T20:59:59Z'))).toBe(false); // 23:59:59
    expect(isLateNight(at('2026-10-26T21:00:00Z'))).toBe(true); // 00:00
  });
  it('ends at 05:00 Istanbul', () => {
    expect(isLateNight(at('2026-10-27T01:59:59Z'))).toBe(true); // 04:59:59
    expect(isLateNight(at('2026-10-27T02:00:00Z'))).toBe(false); // 05:00
  });
  it('reads the Istanbul hour, not the machine hour', () => {
    expect(istanbulHour(at('2026-10-27T00:30:00Z'))).toBe(3);
    expect(istanbulHour(at('2026-10-27T12:00:00Z'))).toBe(15);
  });
});

describe('createRapidClickCounter', () => {
  it('fires on the 7th quick click and lets the first one through', () => {
    const click = createRapidClickCounter();
    const first = click(0);
    expect(first).toEqual({ count: 1, inSequence: false, fired: false });
    for (let i = 1; i < 6; i++) expect(click(i * 300)).toMatchObject({ count: i + 1, inSequence: true, fired: false });
    expect(click(1800)).toEqual({ count: 7, inSequence: true, fired: true });
    // Starts over after firing.
    expect(click(2000)).toMatchObject({ count: 1, inSequence: false });
  });

  it('restarts after a slow gap', () => {
    const click = createRapidClickCounter();
    click(0); click(300); click(600);
    expect(click(1500)).toEqual({ count: 1, inSequence: false, fired: false });
  });

  it('restarts when the run outlasts the window', () => {
    const click = createRapidClickCounter({ target: 7, windowMs: 3000, gapMs: 700 });
    let r = click(0);
    for (let i = 1; i <= 5; i++) r = click(i * 650); // 3250 ms total
    expect(r.fired).toBe(false);
    expect(r.count).toBe(1);
  });

  it('keeps ordinary single clicks out of a sequence', () => {
    const click = createRapidClickCounter();
    expect(click(0).inSequence).toBe(false);
    expect(click(5000).inSequence).toBe(false);
  });
});
