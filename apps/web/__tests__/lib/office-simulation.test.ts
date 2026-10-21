import { CATEGORY } from '@/lib/features/office/catalog';
import { DESKS, LOUNGE_SEATS, MANAGER_DESK, briefingSpot, pathFromBrief, pathToBrief, pathToDesk, pathToLounge } from '@/lib/features/office/layout';
import { OFFICE_MODELS, TIER_MODEL, decide } from '@/lib/features/office/routing';
import { OfficeSimulation, type RemoteTask } from '@/lib/features/office/simulation';

/** Ticks in small steps, as the scene does, until the condition holds or the time runs out. */
function runUntil(sim: OfficeSimulation, done: () => boolean, maxSeconds = 120) {
  for (let t = 0; t < maxSeconds && !done(); t += 0.1) sim.tick(0.1);
  if (!done()) throw new Error('koşul gerçekleşmedi');
}

describe('AI office simulation', () => {
  it('the manager decides, walks over and taps the person, who then takes a desk', () => {
    const sim = new OfficeSimulation();
    const task = sim.assign({ category: 'design', title: 'Fuar afişi', brief: 'A1, kurumsal renkler' });
    const deniz = sim.agent('deniz')!, kaan = sim.manager;
    expect(task).toMatchObject({ agentId: 'deniz', status: 'assigned' });
    expect(task.decision).toMatchObject({ difficulty: 'medium', model: { id: 'claude-sonnet-5-5' }, missing: ['image'] });
    expect(deniz.phase).toBe('called');
    expect(kaan.phase).toBe('to_brief');

    runUntil(sim, () => kaan.phase === 'briefing');
    const spot = briefingSpot(LOUNGE_SEATS[deniz.seatIndex]);
    expect(kaan.position.x).toBeCloseTo(spot.x);
    expect(kaan.position.z).toBeCloseTo(spot.z);
    expect(deniz.phase).toBe('called');

    runUntil(sim, () => deniz.phase === 'to_desk');
    expect(kaan.phase).toBe('to_office');
    runUntil(sim, () => kaan.phase === 'managing');
    expect(kaan.position).toEqual({ x: MANAGER_DESK.chair.x, z: MANAGER_DESK.chair.z });
  });

  it('sends the category person to a desk, works, delivers and returns to the lounge', () => {
    const sim = new OfficeSimulation();
    const task = sim.assign({ category: 'design', title: 'Fuar afişi', brief: 'A1, kurumsal renkler' });
    const deniz = sim.agent('deniz')!;

    runUntil(sim, () => deniz.phase === 'working');
    const desk = sim.desk(deniz.deskId)!;
    expect(deniz.position).toEqual({ x: desk.chair.x, z: desk.chair.z });
    expect(task.status).toBe('working');

    runUntil(sim, () => task.status === 'review');
    expect(task.deliverable).toEqual({ name: 'fuar-afisi.png', kind: CATEGORY.design.output.kind });
    expect(sim.events.filter(e => e.kind === 'technical' && e.agentId === 'deniz')).toHaveLength(CATEGORY.design.steps.length);

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

  it('hands out one task at a time: the next waits until the manager is back at the desk', () => {
    const sim = new OfficeSimulation();
    const first = sim.assign({ category: 'spreadsheet', title: 'Gider tablosu' });
    const second = sim.assign({ category: 'translation', title: 'Katalog çevirisi' });
    expect(first.status).toBe('assigned');
    expect(second.status).toBe('queued');
    runUntil(sim, () => second.status === 'assigned');
    expect(sim.agent('murat')!.phase).not.toBe('called');
    expect(sim.agent('can')!.phase).toBe('called');
    expect(sim.manager.phase).toBe('to_brief');
  });

  it('runs different categories at the same time on different desks', () => {
    const sim = new OfficeSimulation();
    sim.assign({ category: 'research', title: 'Kapsamlı rakip analizi', brief: 'x'.repeat(900) });
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

  it('takes longer on a hard task than on an easy one', () => {
    const sim = new OfficeSimulation();
    const easy = sim.assign({ category: 'correspondence', title: 'Kısa teşekkür' });
    runUntil(sim, () => easy.status === 'review');
    const easyTime = easy.deliveredAt! - easy.startedAt!;
    const hard = sim.assign({ category: 'research', title: 'Kapsamlı rakip analizi', brief: 'x'.repeat(900) });
    expect(hard.decision?.difficulty).toBe('hard');
    runUntil(sim, () => hard.status === 'review', 200);
    expect(hard.deliveredAt! - hard.startedAt!).toBeGreaterThan(easyTime * 2);
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
    for (const seat of LOUNGE_SEATS) for (const desk of [...DESKS, MANAGER_DESK]) {
      const spot = briefingSpot(seat);
      for (const path of [[seat, ...pathToDesk(seat, desk)], [desk.chair, ...pathToLounge(desk, seat)], [MANAGER_DESK.chair, ...pathToBrief(seat)], [spot, ...pathFromBrief(seat)]]) {
        for (let i = 1; i < path.length; i++) expect(crossesDesk(path[i - 1], path[i])).toBe(false);
      }
    }
  });
});

describe('office manager model choice', () => {
  const task = (category: Parameters<typeof decide>[0]['category'], title: string, brief = '', revisions = 0) => ({ category, title, brief, revisions });

  it('rates difficulty from the kind of work, the brief and revisions', () => {
    expect(decide(task('correspondence', 'Teşekkür e-postası')).difficulty).toBe('easy');
    expect(decide(task('spreadsheet', 'Gider tablosu', 'formül ile aylık toplam')).difficulty).toBe('medium');
    expect(decide(task('research', 'Kapsamlı rakip analizi', 'x'.repeat(400))).difficulty).toBe('hard');
    expect(decide(task('document', 'Garanti belgesi', '', 1)).difficulty).toBe('medium');
  });

  it('uses only Claude Sonnet 5.5 for now, whatever the difficulty', () => {
    expect(Object.keys(OFFICE_MODELS)).toEqual(['claude-sonnet-5-5']);
    expect(new Set(Object.values(TIER_MODEL))).toEqual(new Set(['claude-sonnet-5-5']));
    for (const category of Object.keys(CATEGORY) as Array<keyof typeof CATEGORY>) {
      expect(decide(task(category, 'x')).model.id).toBe('claude-sonnet-5-5');
    }
  });

  it('says what the model cannot do for the category', () => {
    expect(decide(task('design', 'Afiş')).missing).toEqual(['image']);
    expect(decide(task('document', 'Belge')).missing).toEqual([]);
  });
});

describe('office simulation following real tasks', () => {
  const remote = (over: Partial<RemoteTask> = {}): RemoteTask => ({
    id: 'srv-1', number: 7, category: 'presentation', title: 'Bayi sunumu', brief: '', status: 'working',
    decision: decide({ category: 'presentation', title: 'Bayi sunumu', brief: '', revisions: 0 }),
    question: null, revisions: 0, notes: [], summary: null, error: null, costUsd: 0, files: [], ...over,
  });

  it('walks a real task to a desk and waits at 95 % until the server delivers', () => {
    const sim = new OfficeSimulation();
    sim.sync([remote()]);
    const task = sim.task('srv-1')!;
    const zeynep = sim.agent('zeynep')!;
    runUntil(sim, () => zeynep.phase === 'working');
    for (let i = 0; i < 600; i++) sim.tick(0.1);
    expect(task.progress).toBeCloseTo(0.95);
    expect(task.status).toBe('working');

    sim.sync([remote({ status: 'review', files: [{ id: 'f1', name: 'bayi-sunumu.pptx', contentType: 'x', size: 10, revision: 0, url: '/f1' }] })]);
    runUntil(sim, () => task.status === 'review');
    expect(task.deliverable?.name).toBe('bayi-sunumu.pptx');
    runUntil(sim, () => zeynep.phase === 'lounge');
  });

  it('raises a hand while the server waits for an answer and goes on after it', () => {
    const sim = new OfficeSimulation();
    sim.sync([remote()]);
    const zeynep = sim.agent('zeynep')!;
    runUntil(sim, () => zeynep.phase === 'working');
    sim.sync([remote({ status: 'needs_input', question: 'Kaç slayt?' })]);
    sim.tick(0.1);
    expect(zeynep.phase).toBe('asking');
    expect(sim.task('srv-1')!.status).toBe('asking');
    sim.sync([remote({ status: 'working' })]);
    sim.tick(0.1);
    expect(zeynep.phase).toBe('working');
  });

  it('shows a failure, and a retry sends the task through the office again', () => {
    const sim = new OfficeSimulation();
    sim.sync([remote()]);
    const task = sim.task('srv-1')!;
    runUntil(sim, () => task.status === 'working');
    sim.sync([remote({ status: 'failed', error: 'zaman aşımı' })]);
    runUntil(sim, () => task.status === 'failed');
    expect(sim.events.some(e => e.text.includes('tamamlayamadı: zaman aşımı'))).toBe(true);
    runUntil(sim, () => sim.agent('zeynep')!.phase === 'lounge');
    sim.sync([remote({ status: 'queued' })]);
    expect(['queued', 'assigned']).toContain(task.status);
  });

  it('shows tasks already finished when the page opens without walking anyone', () => {
    const sim = new OfficeSimulation();
    sim.sync([remote({ status: 'approved', files: [{ id: 'f1', name: 'a.pptx', contentType: 'x', size: 1, revision: 0, url: '/f1' }] })]);
    expect(sim.task('srv-1')).toMatchObject({ status: 'approved', deliverable: { name: 'a.pptx' } });
    expect(sim.manager.phase).toBe('managing');
  });
});
