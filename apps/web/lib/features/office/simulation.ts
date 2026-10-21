import { CATEGORY, STAFF, isTaskCategory, type Look, type TaskCategoryId } from './catalog';
import { DESKS, LOUNGE_SEATS, MANAGER_DESK, pathFromBrief, pathToBrief, pathToDesk, pathToLounge, type Desk, type Point } from './layout';
import { DIFFICULTY_LABELS, DIFFICULTY_PACE, MISSING_NOTE, decide, type ManagerDecision } from './routing';
import { triageByRules } from './triage';

/**
 * The AI office in motion: the manager weighs a handed-over task (how hard, which model), gets up,
 * walks over to the category's person in the lounge and hands it over with a tap on the shoulder.
 * That person walks to a free desk, works through the category's steps, delivers and goes back to
 * the lounge; the manager returns to their desk for the next task, one task at a time.
 * Time only moves through tick(), so the scene, the panel and the tests drive the same clock.
 *
 * A task either lives only here (simulation: progress follows the category's workSeconds and the
 * delivery is a placeholder name) or mirrors a real task on the server through sync(): the server's
 * status then decides when the person raises a hand, delivers or gives up, and the scene only
 * animates the way there.
 */

export type AgentPhase =
  | 'lounge' | 'called' | 'to_desk' | 'working' | 'asking' | 'delivering' | 'to_lounge'
  // The manager's own phases: at the desk, on the way to someone, handing over, back to the desk.
  | 'managing' | 'to_brief' | 'briefing' | 'to_office' | 'to_review' | 'checking';
export type TaskStatus = 'queued' | 'assigned' | 'working' | 'asking' | 'review' | 'approved' | 'failed';

/** A task as the server reports it (lib/features/office/service.server.ts). */
export type RemoteTask = {
  id: string; number: number; category: TaskCategoryId; title: string; brief: string;
  status: 'queued' | 'working' | 'needs_input' | 'review' | 'approved' | 'failed';
  decision: ManagerDecision; question: string | null; revisions: number; notes: string[];
  summary: string | null; error: string | null; costUsd: number;
  files: Array<{ id: string; name: string; contentType: string; size: number; revision: number; url: string }>;
};
export type EventKind = 'activity' | 'technical' | 'delivery';

export type Agent = {
  id: string; name: string; title: string; role: TaskCategoryId | 'manager'; look: Look;
  phase: AgentPhase; position: Point; facing: number; seated: boolean;
  path: Point[]; deskId: string | null; taskId: string | null; seatIndex: number;
  /** Seconds spent in the current phase. */
  phaseTime: number;
};

export type Task = {
  id: string; number: number; category: TaskCategoryId; title: string; brief: string;
  status: TaskStatus; agentId: string | null; progress: number; step: number;
  createdAt: number; startedAt: number | null; deliveredAt: number | null;
  revisions: number; notes: string[];
  /** The manager's call, made when the task is picked up; null while it waits. */
  decision: ManagerDecision | null;
  deliverable: { name: string; kind: string } | null;
  /** The server's copy when the task is real; null in the simulation. */
  remote: RemoteTask | null;
};

export type OfficeEvent = { id: number; at: number; kind: EventKind; agentId: string | null; taskId: string | null; text: string };

export const WALK_SPEED = 2;
export const DELIVER_SECONDS = 1.5;
export const BRIEF_SECONDS = 1.6;
const EVENT_LIMIT = 300;

const slug = (text: string) => text.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'gorev';

export class OfficeSimulation {
  time = 0;
  /** Bumped on every change a viewer should redraw for. */
  version = 0;
  readonly agents: Agent[];
  readonly tasks: Task[] = [];
  readonly events: OfficeEvent[] = [];
  private readonly deskOwner = new Map<string, string>();
  private listeners = new Set<() => void>();
  private eventSeq = 0;
  private taskSeq = 0;

  constructor() {
    let seat = 0;
    this.agents = STAFF.map(member => {
      const manager = member.role === 'manager';
      const home = manager ? MANAGER_DESK.chair : LOUNGE_SEATS[seat];
      return {
        ...member, phase: manager ? 'managing' : 'lounge', position: { x: home.x, z: home.z }, facing: home.facing, seated: true,
        path: [], deskId: manager ? MANAGER_DESK.id : null, taskId: null, seatIndex: manager ? -1 : seat++, phaseTime: 0,
      };
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getVersion = () => this.version;

  agent(id: string | null) { return this.agents.find(a => a.id === id); }
  task(id: string | null) { return this.tasks.find(t => t.id === id); }
  desk(id: string | null): Desk | undefined { return id === MANAGER_DESK.id ? MANAGER_DESK : DESKS.find(d => d.id === id); }
  get manager() { return this.agents.find(a => a.role === 'manager')!; }

  /** Hands a task to the office; the manager gives it to the category's person when they are free. */
  assign(input: { category: string; title: string; brief?: string; triage?: ManagerDecision['triage'] }): Task {
    if (!isTaskCategory(input.category)) throw new Error(`Bilinmeyen görev türü: ${input.category}`);
    const title = input.title.trim();
    if (!title) throw new Error('Görevin bir başlığı olmalı.');
    const number = ++this.taskSeq;
    const task: Task = {
      id: `task-${number}`, number, category: input.category, title, brief: input.brief?.trim() ?? '',
      status: 'queued', agentId: null, progress: 0, step: -1, createdAt: this.time, startedAt: null, deliveredAt: null,
      revisions: 0, notes: [], decision: null, deliverable: null, remote: null,
    };
    this.tasks.push(task);
    if (input.triage) this.pendingTriage.set(task.id, input.triage);
    this.log('activity', this.manager.id, task.id, `Yeni görev #${number}: ${title} (${CATEGORY[task.category].label})`);
    this.dispatch();
    this.changed();
    return task;
  }

  /** A task written in plain words: the manager reads which kind of work it is (keyword rules here). */
  assignText(text: string): Task {
    const read = triageByRules(text);
    return this.assign({ category: read.category, title: read.title, brief: text, triage: { by: read.by, reason: read.reason } });
  }

  private readonly pendingTriage = new Map<string, NonNullable<ManagerDecision['triage']>>();

  approve(taskId: string) {
    const task = this.task(taskId);
    if (!task || task.status !== 'review') return;
    task.status = 'approved';
    this.log('delivery', task.agentId, task.id, `#${task.number} onaylandı: ${task.deliverable?.name}`);
    this.changed();
  }

  /** Sends a delivered task back to its person with the reviewer's note. */
  requestRevision(taskId: string, note: string) {
    const task = this.task(taskId);
    if (!task || task.status !== 'review') return;
    task.status = 'queued';
    task.decision = null;
    task.progress = 0;
    task.step = -1;
    task.revisions += 1;
    if (note.trim()) task.notes.push(note.trim());
    this.log('activity', task.agentId, task.id, `#${task.number} revizyona döndü${note.trim() ? `: ${note.trim()}` : ''}`);
    this.dispatch();
    this.changed();
  }

  /**
   * Brings real tasks in from the server. A task that is still to be done enters the office the
   * usual way (the manager hands it over); one already finished when the page opens is shown as is.
   */
  sync(remote: RemoteTask[]) {
    for (const r of remote) {
      let task = this.task(r.id);
      if (!task) {
        const active = r.status === 'queued' || r.status === 'working' || r.status === 'needs_input';
        task = {
          id: r.id, number: r.number, category: r.category, title: r.title, brief: r.brief,
          status: active ? 'queued' : (r.status as 'review' | 'approved' | 'failed'), agentId: null, progress: active ? 0 : 1, step: -1,
          createdAt: this.time, startedAt: null, deliveredAt: null, revisions: r.revisions, notes: [...r.notes],
          decision: r.decision, deliverable: active ? null : this.remoteDeliverable(r), remote: r,
        };
        this.taskSeq = Math.max(this.taskSeq, r.number);
        this.tasks.push(task);
        if (active) this.log('activity', this.manager.id, task.id, `Yeni görev #${r.number}: ${r.title} (${CATEGORY[r.category].label})`);
        continue;
      }
      const before = task.remote?.status;
      const previousReview = task.remote?.decision.review?.checkedAt;
      const previousRevision = task.revisions;
      task.remote = r;
      task.decision = r.decision;
      task.revisions = r.revisions;
      task.notes = [...r.notes];
      if (r.decision.review && r.decision.review.checkedAt !== previousReview) {
        this.log('technical', this.manager.id, task.id, `#${task.number} · ${r.decision.review.note}`);
      }
      this.changed();
      if (r.status === before) continue;
      if (r.status === 'approved' && task.status === 'review') {
        task.status = 'approved';
        this.log('delivery', task.agentId, task.id, `#${task.number} onaylandı: ${task.deliverable?.name ?? task.title}`);
      } else if (r.status === 'queued' && (task.status === 'review' || task.status === 'failed')) {
        // Sent back for a revision or retried: it goes through the office again.
        const revised = r.revisions > previousRevision;
        task.status = 'queued';
        task.progress = 0;
        task.step = -1;
        task.revisions = r.revisions;
        task.notes = [...r.notes];
        task.deliverable = null;
        this.log('activity', task.agentId, task.id, `#${task.number} yeniden sıraya girdi${revised ? ' (revizyon)' : ''}`);
      }
      this.changed();
    }
    this.dispatch();
  }

  private remoteDeliverable(r: RemoteTask) {
    const latest = r.files.filter(f => f.revision === r.revisions);
    return latest.length ? { name: latest.map(f => f.name).join(', '), kind: CATEGORY[r.category].output.kind } : null;
  }

  tick(seconds: number) {
    if (seconds <= 0) return;
    this.time += seconds;
    for (const agent of this.agents) {
      agent.phaseTime += seconds;
      // Walking is redrawn by the scene every frame; only arrivals change what the panel shows.
      if (agent.path.length) { this.walk(agent, seconds); continue; }
      if (agent.phase === 'working') this.work(agent, seconds);
      else if (agent.phase === 'asking' && this.task(agent.taskId)?.remote?.status !== 'needs_input') this.resumeWork(agent);
      else if (agent.phase === 'delivering' && agent.phaseTime >= DELIVER_SECONDS) this.leaveDesk(agent);
      else if (agent.phase === 'checking' && agent.phaseTime >= 2 && (this.task(agent.taskId)?.remote?.status !== 'working' || this.task(agent.taskId)?.remote?.decision.review?.status !== 'checking')) this.finishInspection(agent);
      else if (agent.phase === 'briefing' && agent.phaseTime >= BRIEF_SECONDS) this.handOver(agent);
    }
  }

  private walk(agent: Agent, seconds: number) {
    let budget = seconds * WALK_SPEED;
    while (budget > 0 && agent.path.length) {
      const target = agent.path[0];
      const dx = target.x - agent.position.x, dz = target.z - agent.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 1e-6) agent.facing = Math.atan2(dx, dz);
      if (distance <= budget) {
        agent.position = { x: target.x, z: target.z };
        agent.path.shift();
        budget -= distance;
      } else {
        agent.position = { x: agent.position.x + (dx / distance) * budget, z: agent.position.z + (dz / distance) * budget };
        budget = 0;
      }
    }
    if (agent.path.length) return;
    if (agent.phase === 'to_desk') this.sitAtDesk(agent);
    else if (agent.phase === 'to_lounge') this.sitInLounge(agent);
    else if (agent.phase === 'to_brief') this.startBriefing(agent);
    else if (agent.phase === 'to_review') { agent.facing = Math.PI; this.setPhase(agent, 'checking'); }
    else if (agent.phase === 'to_office') this.backToManagerDesk(agent);
  }

  /** The manager has reached the person and turns to them. */
  private startBriefing(manager: Agent) {
    const agent = this.agent(this.task(manager.taskId)!.agentId)!;
    const seat = LOUNGE_SEATS[agent.seatIndex];
    manager.facing = Math.atan2(seat.x - manager.position.x, seat.z - manager.position.z);
    this.setPhase(manager, 'briefing');
    this.log('activity', manager.id, manager.taskId, `${manager.name}, görevi ${agent.name} ile konuşuyor`);
  }

  /** The tap on the shoulder: the person gets up for the desk, the manager heads back. */
  private handOver(manager: Agent) {
    const task = this.task(manager.taskId)!;
    const agent = this.agent(task.agentId)!;
    const seat = LOUNGE_SEATS[agent.seatIndex];
    agent.seated = false;
    agent.path = pathToDesk(seat, this.desk(agent.deskId)!);
    this.setPhase(agent, 'to_desk');
    this.log('activity', agent.id, task.id, `${agent.name}, #${task.number} görevini üstlendi · ${task.decision!.model.label}`);
    manager.taskId = null;
    manager.path = pathFromBrief(seat);
    this.setPhase(manager, 'to_office');
  }

  private backToManagerDesk(manager: Agent) {
    manager.facing = MANAGER_DESK.chair.facing;
    manager.seated = true;
    this.setPhase(manager, 'managing');
    this.dispatch();
  }

  private sitAtDesk(agent: Agent) {
    const task = this.task(agent.taskId)!;
    agent.facing = this.desk(agent.deskId)!.chair.facing;
    agent.seated = true;
    this.setPhase(agent, 'working');
    task.status = 'working';
    task.startedAt = this.time;
    this.log('activity', agent.id, task.id, `${agent.name} masasına oturdu, #${task.number} üzerinde çalışıyor`);
  }

  private work(agent: Agent, seconds: number) {
    const task = this.task(agent.taskId)!;
    const category = CATEGORY[task.category];
    const remote = task.remote?.status;
    if (task.remote?.decision.review?.status === 'checking') this.dispatch();
    if (remote === 'needs_input') return this.raiseHand(agent, task);
    const before = Math.floor(task.progress * 100);
    const pace = seconds / (category.workSeconds * DIFFICULTY_PACE[task.decision!.difficulty]);
    // A real task waits at 95 % until the server reports the delivery; the simulation finishes on time.
    if (!task.remote) task.progress = Math.min(1, task.progress + pace);
    else if (remote === 'review' || remote === 'approved' || remote === 'failed') task.progress = 1;
    else task.progress = Math.min(0.95, task.progress + pace);
    const step = Math.min(category.steps.length - 1, Math.floor(task.progress * category.steps.length));
    if (step !== task.step) {
      task.step = step;
      this.log('technical', agent.id, task.id, `#${task.number} · ${category.steps[step]}`);
    }
    if (Math.floor(task.progress * 100) !== before) this.changed();
    if (task.progress >= 1) this.deliver(agent, task);
  }

  /** The person needs an answer: hand up at the desk until the server says the work goes on. */
  private raiseHand(agent: Agent, task: Task) {
    task.status = 'asking';
    this.setPhase(agent, 'asking');
    this.log('activity', agent.id, task.id, `${agent.name} elini kaldırdı: ${task.remote?.question ?? 'bir sorusu var'}`);
  }

  private resumeWork(agent: Agent) {
    const task = this.task(agent.taskId)!;
    task.status = 'working';
    this.setPhase(agent, 'working');
    this.log('activity', agent.id, task.id, `${agent.name} cevabı aldı, #${task.number} üzerinde çalışmaya devam ediyor`);
  }

  private deliver(agent: Agent, task: Task) {
    const category = CATEGORY[task.category];
    if (this.manager.taskId === task.id && (this.manager.phase === 'to_review' || this.manager.phase === 'checking')) return;
    task.deliveredAt = this.time;
    this.setPhase(agent, 'delivering');
    if (task.remote?.status === 'failed') {
      task.status = 'failed';
      this.log('delivery', agent.id, task.id, `${agent.name}, #${task.number} işini tamamlayamadı: ${task.remote.error ?? 'bilinmeyen hata'}`);
      return;
    }
    task.status = task.remote?.status === 'approved' ? 'approved' : 'review';
    task.deliverable = task.remote
      ? this.remoteDeliverable(task.remote) ?? { name: task.title, kind: category.output.kind }
      : { name: `${slug(task.title)}${task.revisions ? `-r${task.revisions}` : ''}.${category.output.extension}`, kind: category.output.kind };
    this.log('delivery', agent.id, task.id, `${agent.name} teslim etti: ${task.deliverable.name} — onayınızı bekliyor`);
  }

  private leaveDesk(agent: Agent) {
    const desk = this.desk(agent.deskId)!;
    this.deskOwner.delete(desk.id);
    agent.deskId = null;
    agent.taskId = null;
    agent.seated = false;
    agent.path = pathToLounge(desk, LOUNGE_SEATS[agent.seatIndex]);
    this.setPhase(agent, 'to_lounge');
    this.log('activity', agent.id, null, `${agent.name} masadan kalktı`);
    this.dispatch();
  }

  private sitInLounge(agent: Agent) {
    agent.facing = LOUNGE_SEATS[agent.seatIndex].facing;
    agent.seated = true;
    this.setPhase(agent, 'lounge');
    this.dispatch();
  }

  /**
   * The manager takes the oldest waiting task whose person is in the lounge, decides how hard it is
   * and which model runs it, keeps a desk for it and walks over. One task at a time: the rest wait
   * until the manager is back at the desk.
   */
  private dispatch() {
    const manager = this.manager;
    if (manager.phase !== 'managing') return;
    const checking = this.tasks.find(t => t.remote?.status === 'working' && t.remote?.decision.review?.status === 'checking' && this.agent(t.agentId)?.phase === 'working');
    if (checking) {
      const desk = this.desk(this.agent(checking.agentId)!.deskId)!;
      manager.taskId = checking.id;
      manager.seated = false;
      manager.path = [{ x: MANAGER_DESK.x, z: MANAGER_DESK.aisleZ }, { x: -4.5, z: MANAGER_DESK.aisleZ }, { x: -4.5, z: desk.aisleZ }, { x: desk.x + 0.8, z: desk.aisleZ }, { x: desk.x + 0.8, z: desk.chair.z }];
      this.setPhase(manager, 'to_review');
      this.log('activity', manager.id, checking.id, `${manager.name}, #${checking.number} teslimini çalışanın ekranında kontrol etmeye gidiyor`);
      return;
    }
    for (const task of this.tasks) {
      if (task.status !== 'queued') continue;
      const agent = this.agents.find(a => a.role === task.category && a.phase === 'lounge');
      const desk = agent && this.freeDesk(agent.position);
      if (!agent || !desk) continue;
      this.deskOwner.set(desk.id, agent.id);
      agent.deskId = desk.id;
      agent.taskId = task.id;
      this.setPhase(agent, 'called');
      task.agentId = agent.id;
      task.status = 'assigned';
      // A real task carries the server's call; the simulation decides here.
      const decision = task.decision = task.remote?.decision ?? { ...decide(task), triage: this.pendingTriage.get(task.id) };
      this.pendingTriage.delete(task.id);
      if (decision.triage) this.log('technical', manager.id, task.id, `${manager.name} #${task.number} görevini okudu: ${CATEGORY[task.category].label} — ${decision.triage.reason}${decision.triage.by === 'model' ? '' : ' (kurallar)'}`);
      const why = decision.reasons.length ? ` (${decision.reasons.join(', ')})` : '';
      this.log('technical', manager.id, task.id, `${manager.name} #${task.number} için karar verdi: zorluk ${DIFFICULTY_LABELS[decision.difficulty]}${why} → ${decision.model.label}`);
      for (const need of decision.missing) if (MISSING_NOTE[need]) this.log('technical', manager.id, task.id, `#${task.number} · Not: ${MISSING_NOTE[need]}`);
      manager.taskId = task.id;
      manager.seated = false;
      manager.path = pathToBrief(LOUNGE_SEATS[agent.seatIndex]);
      this.setPhase(manager, 'to_brief');
      this.log('activity', manager.id, task.id, `${manager.name}, #${task.number} görevini vermek için ${agent.name} ile konuşmaya gidiyor`);
      return;
    }
  }

  private finishInspection(manager: Agent) {
    const task = this.task(manager.taskId);
    const desk = this.desk(this.agent(task?.agentId ?? null)?.deskId ?? null);
    this.log('technical', manager.id, manager.taskId, task?.remote?.decision.review?.note ?? 'Yönetici kontrolü tamamlandı.');
    manager.path = [{ x: manager.position.x, z: desk?.aisleZ ?? manager.position.z }, { x: -4.5, z: desk?.aisleZ ?? manager.position.z }, { x: -4.5, z: MANAGER_DESK.aisleZ }, { x: MANAGER_DESK.x, z: MANAGER_DESK.aisleZ }, { x: MANAGER_DESK.chair.x, z: MANAGER_DESK.chair.z }];
    manager.taskId = null;
    this.setPhase(manager, 'to_office');
  }

  /** The free desk closest to the lounge exit, so the front rows fill first. */
  private freeDesk(from: Point) {
    return DESKS.filter(d => !this.deskOwner.has(d.id))
      .sort((a, b) => Math.hypot(a.x - from.x, a.aisleZ - from.z) - Math.hypot(b.x - from.x, b.aisleZ - from.z))[0];
  }

  private setPhase(agent: Agent, phase: AgentPhase) {
    agent.phase = phase;
    agent.phaseTime = 0;
    this.changed();
  }

  private log(kind: EventKind, agentId: string | null, taskId: string | null, text: string) {
    this.events.unshift({ id: ++this.eventSeq, at: this.time, kind, agentId, taskId, text });
    if (this.events.length > EVENT_LIMIT) this.events.length = EVENT_LIMIT;
    this.changed();
  }

  private changed() {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
