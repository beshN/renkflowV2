export type RapidClickResult = {
  /** Clicks in the current run, this one included. */
  count: number;
  /** A follow-up click of a run (not the first): the caller may swallow its default action. */
  inSequence: boolean;
  /** The run just reached the target; the counter starts over. */
  fired: boolean;
};

/**
 * Counts quick repeated clicks. A run continues while each click comes within `gapMs` of
 * the previous one and the whole run stays inside `windowMs`; anything slower starts a
 * new run, so an ordinary single click is never part of a sequence.
 */
export function createRapidClickCounter({ target = 7, windowMs = 3000, gapMs = 700 } = {}) {
  let times: number[] = [];
  return (now: number): RapidClickResult => {
    const last = times[times.length - 1];
    if (last === undefined || now - last > gapMs || now - times[0] > windowMs) times = [];
    times.push(now);
    const count = times.length;
    if (count >= target) {
      times = [];
      return { count, inSequence: true, fired: true };
    }
    return { count, inSequence: count > 1, fired: false };
  };
}
