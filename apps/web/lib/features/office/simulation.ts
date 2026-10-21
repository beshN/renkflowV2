import { CATEGORY, STAFF, isTaskCategory, type Look, type TaskCategoryId } from './catalog';
import { DESKS, LOUNGE_SEATS, MANAGER_DESK, pathToDesk, pathToLounge, type Desk, type Point } from './layout';

/**
 * The AI office in motion: a handed-over task goes to the member of staff for its category, who
 * walks to a free desk, works through the category's steps, delivers and goes back to the lounge.
 * Time only moves through tick(), so the scene, the panel and the tests drive the same clock.
 *
 * Until a model is connected the work itself is simulated: progress follows the category's
 * workSeconds and the delivery is a placeholder file name.
 */

export type AgentPhase = 'lounge' | 'to_desk' | 'working' | 'delivering' | 'to_lounge' | 'managing';
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
  deliverable: { name: string; kind: string } | null;
};

export type OfficeEvent = { id: number; at: number; kind: EventKind; agentId: string | null; taskId: string | null; text: string };

export const WALK_SPEED = 1.7;
export const DELIVER_SECONDS = 1.5;
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
      revisions: 0, notes: [], deliverable: null,
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
    task.progress = Math.min(1, task.progress + seconds / category.workSeconds);
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

  /** Gives waiting tasks, oldest first, to their category's person once that person is in the lounge. */
  private dispatch() {
    for (const task of this.tasks) {
      if (task.status !== 'queued') continue;
      const agent = this.agents.find(a => a.role === task.category && a.phase === 'lounge');
      const desk = agent && this.freeDesk(agent.position);
      if (!agent || !desk) continue;
      this.deskOwner.set(desk.id, agent.id);
      agent.deskId = desk.id;
      agent.taskId = task.id;
      agent.seated = false;
      agent.path = pathToDesk(LOUNGE_SEATS[agent.seatIndex], desk);
      task.agentId = agent.id;
      task.status = 'assigned';
      this.setPhase(agent, 'to_desk');
      this.log('activity', this.manager.id, task.id, `${agent.name}, #${task.number} görevini üstlendi (atayan: ${this.manager.name})`);
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
