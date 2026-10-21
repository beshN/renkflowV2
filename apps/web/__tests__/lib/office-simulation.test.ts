import { CATEGORY } from '@/lib/features/office/catalog';
import { DESKS, LOUNGE_SEATS, pathToDesk, pathToLounge } from '@/lib/features/office/layout';
import { OfficeSimulation } from '@/lib/features/office/simulation';

/** Ticks in small steps, as the scene does, until the condition holds or the time runs out. */
function runUntil(sim: OfficeSimulation, done: () => boolean, maxSeconds = 120) {
  for (let t = 0; t < maxSeconds && !done(); t += 0.1) sim.tick(0.1);
  if (!done()) throw new Error('koşul gerçekleşmedi');
}

describe('AI office simulation', () => {
  it('sends the category person to a desk, works, delivers and returns to the lounge', () => {
    const sim = new OfficeSimulation();
    const task = sim.assign({ category: 'design', title: 'Fuar afişi', brief: 'A1, kurumsal renkler' });
    const deniz = sim.agent('deniz')!;
    expect(task.agentId).toBe('deniz');
    expect(deniz.phase).toBe('to_desk');
    expect(task.status).toBe('assigned');

    runUntil(sim, () => deniz.phase === 'working');
    const desk = sim.desk(deniz.deskId)!;
    expect(deniz.position).toEqual({ x: desk.chair.x, z: desk.chair.z });
    expect(task.status).toBe('working');

    runUntil(sim, () => task.status === 'review');
    expect(task.deliverable).toEqual({ name: 'fuar-afisi.png', kind: CATEGORY.design.output.kind });
    expect(sim.events.filter(e => e.kind === 'technical' && e.taskId === task.id)).toHaveLength(CATEGORY.design.steps.length);

    runUntil(sim, () => deniz.phase === 'lounge');
    const seat = LOUNGE_SEATS[deniz.seatIndex];
    expect(deniz.position).toEqual({ x: seat.x, z: seat.z });
    expect(deniz.deskId).toBeNull();
  });

  it('queues a second task of the same kind until the person is free', () => {
    const sim = new OfficeSimulation();
    const first = sim.assign({ category: 'correspondence', title: 'Duyuru' });
    const second = sim.assign({ category: 'correspondence', title: 'Özür e-postası' });
    expect(second.status).toBe('queued');
    runUntil(sim, () => first.status === 'review');
    expect(second.status).toBe('queued');
    runUntil(sim, () => second.status === 'working');
    expect(second.agentId).toBe('selin');
  });

  it('runs different categories at the same time on different desks', () => {
    const sim = new OfficeSimulation();
    sim.assign({ category: 'spreadsheet', title: 'Gider tablosu' });
    sim.assign({ category: 'translation', title: 'Katalog çevirisi' });
    runUntil(sim, () => sim.agents.filter(a => a.phase === 'working').length === 2);
    const desks = sim.agents.filter(a => a.phase === 'working').map(a => a.deskId);
    expect(new Set(desks).size).toBe(2);
  });

  it('approves a delivery or sends it back with a note', () => {
    const sim = new OfficeSimulation();
    const task = sim.assign({ category: 'document', title: 'Garanti belgesi' });
    runUntil(sim, () => task.status === 'review');
    sim.requestRevision(task.id, 'Logo üstte olsun');
    expect(task).toMatchObject({ status: 'queued', revisions: 1, notes: ['Logo üstte olsun'], progress: 0 });
    runUntil(sim, () => task.status === 'review');
    expect(task.deliverable?.name).toBe('garanti-belgesi-r1.docx');
    sim.approve(task.id);
    expect(task.status).toBe('approved');
  });

  it('refuses an unknown category or an empty title', () => {
    const sim = new OfficeSimulation();
    expect(() => sim.assign({ category: 'yoga', title: 'x' })).toThrow('Bilinmeyen görev türü');
    expect(() => sim.assign({ category: 'design', title: '  ' })).toThrow('başlığı');
  });

  it('notifies subscribers when something changes', () => {
    const sim = new OfficeSimulation();
    const listener = jest.fn();
    const unsubscribe = sim.subscribe(listener);
    sim.assign({ category: 'data', title: 'Liste birleştir' });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    sim.assign({ category: 'data', title: 'İkinci liste' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('walks between lounge and desks without crossing a desk', () => {
    const crossesDesk = (from: { x: number; z: number }, to: { x: number; z: number }) => DESKS.some(d => {
      for (let i = 0; i <= 20; i++) {
        const x = from.x + ((to.x - from.x) * i) / 20, z = from.z + ((to.z - from.z) * i) / 20;
        if (Math.abs(x - d.x) < 0.75 && Math.abs(z - d.z) < 0.45) return true;
      }
      return false;
    });
    for (const seat of LOUNGE_SEATS) for (const desk of DESKS) {
      for (const path of [[seat, ...pathToDesk(seat, desk)], [desk.chair, ...pathToLounge(desk, seat)]]) {
        for (let i = 1; i < path.length; i++) expect(crossesDesk(path[i - 1], path[i])).toBe(false);
      }
    }
  });
});
