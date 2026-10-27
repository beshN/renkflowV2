import { CHEERS, FIRST_RUN, cheerLine, formatScore, isFree, pickCheerer, runResult } from '@/lib/features/office/cheer';
import { STAFF } from '@/lib/features/office/catalog';
import type { AgentPhase } from '@/lib/features/office/simulation';

type Mini = { id: string; phase: AgentPhase; path: Array<{ x: number; z: number }>; position: { x: number; z: number } };
const agent = (id: string, phase: AgentPhase, x: number, z: number, walking = false): Mini => ({ id, phase, position: { x, z }, path: walking ? [{ x: 0, z: 0 }] : [] });
const SPOT = { x: 4.5, z: 7 };

describe('office racing record cheer', () => {
  it('detects a record only when the score beats the one before', () => {
    expect(runResult(4250, 3000)).toEqual({ score: 4250, previousBest: 3000, best: 4250, isRecord: true });
    expect(runResult(3000, 3000)).toEqual({ score: 3000, previousBest: 3000, best: 3000, isRecord: false });
    expect(runResult(120, 3000).isRecord).toBe(false);
    expect(runResult(120, 3000).best).toBe(3000);
    expect(runResult(0, 0).isRecord).toBe(false);
    expect(runResult(812.7, 0)).toEqual({ score: 812, previousBest: 0, best: 812, isRecord: true });
  });

  it('formats points the Turkish way', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(999)).toBe('999');
    expect(formatScore(4250)).toBe('4.250');
    expect(formatScore(1234567.9)).toBe('1.234.567');
    expect(formatScore(-5)).toBe('0');
  });

  it('picks the nearest free member of staff, never someone working, in a meeting or walking', () => {
    const agents = [
      agent('murat', 'working', 4.5, 7),
      agent('manager', 'briefing', 4.6, 7),
      agent('elif', 'called', 4.4, 7),
      agent('kerem', 'checking', 4.5, 6.9),
      agent('can', 'lounge', 4.5, 6, true),
      agent('selin', 'lounge', -8, -5),
      agent('deniz', 'break', 3.9, 7),
    ];
    expect(pickCheerer(agents, SPOT)?.id).toBe('deniz');
    expect(pickCheerer(agents.filter(a => a.id !== 'deniz'), SPOT)?.id).toBe('selin');
    expect(pickCheerer(agents.filter(a => !['deniz', 'selin'].includes(a.id)), SPOT)).toBeNull();
    expect(isFree(agent('manager', 'managing', 0, 0))).toBe(true);
    expect(isFree(agent('aylin', 'to_break', 0, 0))).toBe(false);
  });

  it('says a line with the score for a record, a softer one for the first run, nothing otherwise', () => {
    const first = () => 0;
    expect(cheerLine('manager', runResult(4250, 3000), first)).toBe('Rekor! 4.250 puan, kahveler benden.');
    expect(cheerLine('selin', runResult(4250, 3000), () => 0.99)).toContain('4.250');
    expect(cheerLine('selin', runResult(812, 0), first)).toBe(FIRST_RUN[0].replace('{score}', '812'));
    expect(cheerLine('selin', runResult(100, 3000))).toBeNull();
    expect(cheerLine('nobody', runResult(5000, 10), first)).toBe('Rekor! 5.000 puan.');
  });

  it('has lines with the score for every member of staff', () => {
    for (const member of STAFF) {
      expect(CHEERS[member.id]?.length).toBeGreaterThanOrEqual(3);
      for (const line of CHEERS[member.id]) expect(line).toContain('{score}');
    }
  });
});
