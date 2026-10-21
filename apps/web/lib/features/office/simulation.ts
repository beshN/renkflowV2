import { CATEGORY, STAFF, isTaskCategory, type Look, type TaskCategoryId } from './catalog';
import { DESKS, LOUNGE_SEATS, MANAGER_DESK, pathFromBrief, pathToBrief, pathToDesk, pathToLounge, type Desk, type Point } from './layout';
import { DIFFICULTY_LABELS, DIFFICULTY_PACE, MISSING_NOTE, decide, type ManagerDecision } from './routing';

/**
 * The AI office in motion: the manager weighs a handed-over task (how hard, which model), gets up,
 * walks over to the category's person in the lounge and hands it over with a tap on the shoulder.
 * That person walks to a free desk, works through the category's steps, delivers and goes back to
 * the lounge; the manager returns to their desk for the next task, one task at a time.
 * Time only moves through tick(), so the scene, the panel and the tests drive the same clock.
 *
 * Until a model is connected the work itself is simulated: progress follows the category's
 * workSeconds and the delivery is a placeholder file name.
 */

export type AgentPhase =
  | 'lounge' | 'called' | 'to_desk' | 'working' | 'delivering' | 'to_lounge'
  // The manager's own phases: at the desk, on the way to someone, handing over, back to the desk.
  | 'managing' | 'to_brief' | 'briefing' | 'to_office';
export type TaskStatus = 'queued' | 'assigned' | 'working' | 'review' | 'approved';
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
  assign(input: { category: string; title: string; brief?: string }): Task {
    if (!isTaskCategory(input.category)) throw new Error(`Bilinmeyen görev türü: ${input.category}`);
    const title = input.title.trim();
    if (!title) throw new Error('Görevin bir başlığı olmalı.');
    const number = ++this.taskSeq;
    const task: Task = {
      id: `task-${number}`, number, category: input.category, title, brief: input.brief?.trim() ?? '',
      status: 'queued', agentId: null, progress: 0, step: -1, createdAt: this.time, startedAt: null, deliveredAt: null,
      revisions: 0, notes: [], decision: null, deliverable: null,
    };
    this.tasks.push(task);
    this.log('activity', this.manager.id, task.id, `Yeni görev #${number}: ${title} (${CATEGORY[task.category].label})`);
    this.dispatch();
    this.changed();
    return task;
  }

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

  tick(seconds: number) {
    if (seconds <= 0) return;
    this.time += seconds;
    for (const agent of this.agents) {
      agent.phaseTime += seconds;
      // Walking is redrawn by the scene every frame; only arrivals change what the panel shows.
      if (agent.path.length) { this.walk(agent, seconds); continue; }
      if (agent.phase === 'working') this.work(agent, seconds);
      else if (agent.phase === 'delivering' && agent.phaseTime >= DELIVER_SECONDS) this.leaveDesk(agent);
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
    const before = Math.floor(task.progress * 100);
    task.progress = Math.min(1, task.progress + seconds / (category.workSeconds * DIFFICULTY_PACE[task.decision!.difficulty]));
    const step = Math.min(category.steps.length - 1, Math.floor(task.progress * category.steps.length));
    if (step !== task.step) {
      task.step = step;
      this.log('technical', agent.id, task.id, `#${task.number} · ${category.steps[step]}`);
    }
    if (Math.floor(task.progress * 100) !== before) this.changed();
    if (task.progress >= 1) this.deliver(agent, task);
  }

  private deliver(agent: Agent, task: Task) {
    const category = CATEGORY[task.category];
    task.status = 'review';
    task.deliveredAt = this.time;
    task.deliverable = { name: `${slug(task.title)}${task.revisions ? `-r${task.revisions}` : ''}.${category.output.extension}`, kind: category.output.kind };
    this.setPhase(agent, 'delivering');
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
      const decision = task.decision = decide(task);
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
