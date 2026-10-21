'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Check, Download, Hand, Moon, Pause, Play, Plus, RefreshCw, RotateCcw, Sun, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CATEGORY, TASK_CATEGORIES, type TaskCategoryId } from '@/lib/features/office/catalog';
import { DIFFICULTY_LABELS } from '@/lib/features/office/routing';
import { BREAKS, LOUNGE_TEXT, OfficeSimulation, type Agent, type EventKind, type OfficeEvent, type RemoteTask, type Task } from '@/lib/features/office/simulation';
import { createOfficeStage, type OfficeStage } from '@/lib/features/office/scene';

const SPEEDS = [1, 2, 4];
const API = '/api/v1/office';

type Office = {
  /** Real work on the model; false while the office runs as a simulation. */
  live: boolean; reason: string | null; error: string;
  create(input: { text: string; category?: TaskCategoryId }): Promise<void>;
  act(taskId: string, body: Record<string, string>): Promise<void>;
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'İstek tamamlanamadı.');
  return body.data as T;
}

/**
 * Keeps the office in step with the firm's real tasks: polls often while someone is working, rarely
 * otherwise. Without the tables or the model the page stays a simulation and says why.
 */
function useOffice(sim: OfficeSimulation): Office {
  const [state, setState] = useState<{ live: boolean; reason: string | null; error: string }>({ live: false, reason: null, error: '' });
  const refresh = useCallback(async () => {
    try {
      const data = await call<{ live: boolean; reason: string | null; tasks: RemoteTask[] }>(API);
      const before = new Map(sim.tasks.map(t => [t.id, t.remote?.status]));
      sim.sync(data.tasks);
      announce(sim, data.tasks, before);
      setState({ live: data.live, reason: data.reason, error: '' });
      return data.tasks.some(t => t.status === 'queued' || t.status === 'working');
    } catch (error) {
      setState(s => ({ ...s, error: error instanceof Error ? error.message : 'Görevler alınamadı.' }));
      return false;
    }
  }, [sim]);
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const busy = await refresh();
      if (!stopped) timer = setTimeout(loop, busy ? 3000 : 15000);
    };
    loop();
    return () => { stopped = true; clearTimeout(timer); };
  }, [refresh]);
  return {
    ...state,
    async create(input) {
      const task = await call<RemoteTask>(API, { method: 'POST', body: JSON.stringify(input) });
      sim.sync([task]);
      setTimeout(refresh, 1500);
    },
    async act(taskId, body) {
      await call(`${API}/${taskId}`, { method: 'POST', body: JSON.stringify(body) });
      await refresh();
    },
  };
}

/** A short notice when a real task needs the person: delivered, a raised hand, or a failure. */
function announce(sim: OfficeSimulation, tasks: RemoteTask[], before: Map<string, RemoteTask['status'] | undefined>) {
  for (const t of tasks) {
    const was = before.get(t.id);
    if (!was || was === t.status) continue;
    const who = sim.agents.find(a => a.role === t.category)?.name ?? 'Ofis';
    if (t.status === 'review') toast.success(`${who} teslim etti: #${t.number} ${t.title}`);
    else if (t.status === 'needs_input') toast.info(`${who} soruyor: ${t.question ?? '#' + t.number}`);
    else if (t.status === 'failed') toast.error(`#${t.number} tamamlanamadı: ${t.error ?? t.title}`);
  }
}

const usd = (value: number) => `$${value.toFixed(value < 1 ? 3 : 2)}`;
const TABS: Array<{ id: EventKind; label: string }> = [
  { id: 'activity', label: 'Etkinlik' }, { id: 'technical', label: 'Teknik' }, { id: 'delivery', label: 'Teslimatlar' },
];

function ago(sim: OfficeSimulation, at: number) {
  const seconds = Math.floor(sim.time - at);
  if (seconds < 5) return 'şimdi';
  if (seconds < 60) return `${seconds} sn önce`;
  return `${Math.floor(seconds / 60)} dk önce`;
}

function status(sim: OfficeSimulation, agent: Agent): { text: string; tone: 'idle' | 'busy' | 'move' | 'done' } {
  const task = sim.task(agent.taskId);
  switch (agent.phase) {
    case 'managing': {
      const waiting = sim.tasks.filter(t => t.status === 'queued').length;
      return { text: waiting ? `${waiting} görev sırada` : 'Ofisi yönetiyor', tone: waiting ? 'busy' : 'idle' };
    }
    case 'to_brief': return { text: `#${task!.number} için ${sim.agent(task!.agentId)!.name} ile konuşmaya gidiyor`, tone: 'move' };
    case 'to_review': return { text: 'Teslimi kontrol etmeye gidiyor', tone: 'move' };
    case 'checking': return { text: 'Dosyaları ve doğruluğu kontrol ediyor', tone: 'busy' };
    case 'briefing': return { text: 'Görevi anlatıyor', tone: 'busy' };
    case 'to_office': return { text: 'Masasına dönüyor', tone: 'move' };
    case 'called': return { text: 'Yönetici geliyor', tone: 'move' };
    case 'to_desk': return { text: 'Masaya gidiyor', tone: 'move' };
    case 'asking': return { text: 'Elini kaldırdı · sorusu var', tone: 'done' };
    case 'working': if (task?.remote?.decision.review?.status === 'checking') return { text: 'Yönetici kontrol ediyor', tone: 'busy' }; return { text: `${CATEGORY[task!.category].steps[Math.max(0, task!.step)]} · %${Math.floor(task!.progress * 100)}`, tone: 'busy' };
    case 'delivering': return { text: 'Teslim ediyor', tone: 'done' };
    case 'to_lounge': return { text: 'Molaya dönüyor', tone: 'move' };
    case 'to_break': return { text: BREAKS[agent.activity!].going, tone: 'idle' };
    case 'break': return { text: BREAKS[agent.activity!].doing, tone: 'idle' };
    case 'from_break': return { text: agent.role === 'manager' ? 'Masasına dönüyor' : 'Koltuğuna dönüyor', tone: 'idle' };
    default: return { text: LOUNGE_TEXT[agent.lounging], tone: 'idle' };
  }
}

/** The manager's call in a few words, e.g. "Orta · Claude Sonnet 5.5". */
const decisionText = (task: Task) => task.decision ? `${DIFFICULTY_LABELS[task.decision.difficulty]} · ${task.decision.model.label}` : '';

/** Phases with no task in hand: no bubble over the head, at most a small icon. */
const IDLE_PHASES = new Set<Agent['phase']>(['lounge', 'called', 'to_break', 'break', 'from_break']);
/** Only someone at a break spot shows its icon; the lounge and the walkers stay unlabelled. */
function breakIcon(agent: Agent) {
  return agent.phase === 'break' ? BREAKS[agent.activity!].icon : '';
}

const TONE_DOT = { idle: 'bg-zinc-500', busy: 'bg-amber-400', move: 'bg-sky-400', done: 'bg-emerald-400' };
const TONE_TEXT = { idle: 'text-zinc-400', busy: 'text-amber-300', move: 'text-sky-300', done: 'text-emerald-300' };

type View = { speed: number; paused: boolean; night: boolean; tab: EventKind; filter: string };

/**
 * The office outlives the page: going to another menu and back finds the same people mid-walk or
 * at their desks, moved on by the time spent away, instead of the office starting over. One per
 * firm and person, in this browser tab.
 */
let kept: { key: string; sim: OfficeSimulation; leftAt: number | null; view: View } | null = null;

function keptOffice(key: string) {
  if (kept?.key !== key) kept = { key, sim: new OfficeSimulation(), leftAt: null, view: { speed: 1, paused: false, night: true, tab: 'activity', filter: 'all' } };
  return kept;
}

export function OfficeWorkspace({ officeKey }: { officeKey: string }) {
  const [here] = useState(() => keptOffice(officeKey));
  const sim = here.sim;
  // The office changes many times a second; the panel follows at most four times a second (the 3D
  // scene draws itself every frame without React).
  const subscribe = useCallback((notify: () => void) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = sim.subscribe(() => { timer ??= setTimeout(() => { timer = null; notify(); }, 250); });
    return () => { stop(); if (timer) clearTimeout(timer); };
  }, [sim]);
  useSyncExternalStore(subscribe, sim.getVersion, sim.getVersion);
  const office = useOffice(sim);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<OfficeStage | null>(null);
  const labels = useRef(new Map<string, HTMLElement>());
  const [speed, setSpeed] = useState(here.view.speed);
  const [paused, setPaused] = useState(here.view.paused);
  const [night, setNight] = useState(here.view.night);
  const [failed, setFailed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [tab, setTab] = useState<EventKind>(here.view.tab);
  const [filter, setFilter] = useState(here.view.filter);
  useEffect(() => { here.view = { speed, paused, night, tab, filter }; }, [here, speed, paused, night, tab, filter]);

  useEffect(() => {
    if (!canvas.current) return;
    // Time away from the page passes in the office too, at the speed it was left running.
    if (here.leftAt !== null && !here.view.paused) sim.catchUp(((Date.now() - here.leftAt) / 1000) * here.view.speed);
    here.leftAt = null;
    try {
      stage.current = createOfficeStage(canvas.current, sim, labels.current);
    } catch {
      setFailed(true);
      return;
    }
    return () => { stage.current?.dispose(); stage.current = null; here.leftAt = Date.now(); };
  }, [here, sim]);
  useEffect(() => stage.current?.setSpeed(speed), [speed]);
  useEffect(() => stage.current?.setPaused(paused), [paused]);
  useEffect(() => stage.current?.setNight(night), [night]);

  const reviewing = sim.tasks.filter(t => t.status === 'review');
  const asking = sim.tasks.filter(t => t.status === 'asking');
  const spent = sim.tasks.reduce((sum, t) => sum + (t.remote?.costUsd ?? 0), 0);
  const working = sim.agents.filter(a => a.phase === 'working').length;
  const events = sim.events.filter(e => e.kind === tab && (filter === 'all' || e.agentId === filter)).slice(0, 80);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0b1020] text-zinc-100 lg:h-[calc(100dvh-10rem)] lg:min-h-[640px] lg:flex-row">
      <div className="relative min-h-[420px] flex-1">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-label="AI ofisi: çalışanlar ve masaları" />
        {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-zinc-400">Bu tarayıcı 3D ofisi gösteremiyor. Ekip ve görevler sağdaki panelde.</p>}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {sim.agents.map(agent => {
            const s = status(sim, agent);
            return (
              <div key={agent.id} ref={el => { if (el) labels.current.set(agent.id, el); else labels.current.delete(agent.id); }}
                className="absolute left-0 top-0 flex flex-col items-center gap-1 whitespace-nowrap transition-opacity" style={{ opacity: 0 }}>
                {/* A called person's bubble would sit under the manager's; the panel still shows it. A break shows only its icon. */}
                {breakIcon(agent) && <span className="rounded-full bg-zinc-950/70 px-1.5 py-0.5 text-[13px] leading-none" title={s.text}>{breakIcon(agent)}</span>}
                {!breakIcon(agent) && !IDLE_PHASES.has(agent.phase) && (
                  <span className="max-w-[220px] truncate rounded-full border border-amber-400/60 bg-zinc-950/85 px-2.5 py-1 text-[11px] font-medium text-amber-100 shadow">{s.text}</span>
                )}
                <span className="rounded-md bg-zinc-950/75 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200">{agent.name}</span>
              </div>
            );
          })}
        </div>
        <div className="absolute left-3 top-3 flex flex-wrap gap-2 text-xs">
          {office.live
            ? <span className="rounded-lg border border-emerald-500/50 bg-zinc-950/80 px-3 py-1.5 text-emerald-200">Canlı · işler Claude Sonnet 5.5 ile yapılıyor</span>
            : <span className="max-w-[min(520px,80vw)] rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-1.5">{office.reason ?? 'Simülasyon · modeller bağlı değil'}</span>}
          {office.error && <span role="alert" className="rounded-lg border border-red-500/50 bg-zinc-950/80 px-3 py-1.5 text-red-200">{office.error}</span>}
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-950/85 p-1 text-xs">
          <button type="button" onClick={() => setPaused(p => !p)} className="rounded-lg p-2 hover:bg-zinc-800" aria-label={paused ? 'Devam et' : 'Duraklat'}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          {SPEEDS.map(value => (
            <button key={value} type="button" onClick={() => setSpeed(value)} aria-pressed={speed === value}
              className={cn('rounded-lg px-2 py-1.5 font-semibold hover:bg-zinc-800', speed === value && 'bg-zinc-800 text-amber-300')}>{value}×</button>
          ))}
          <button type="button" onClick={() => setNight(n => !n)} className="rounded-lg p-2 hover:bg-zinc-800" aria-label={night ? 'Gündüz görünümü' : 'Gece görünümü'}>
            {night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => stage.current?.resetView()} className="rounded-lg p-2 hover:bg-zinc-800" aria-label="Görünümü sıfırla">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <aside className="flex w-full flex-col border-t lg:min-h-0 border-zinc-800 bg-[#11151f] lg:w-[380px] lg:border-l lg:border-t-0">
        <section className="border-b border-zinc-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Ekip · {sim.agents.length}</h2>
            <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] text-zinc-300">{working} çalışıyor · {reviewing.length} onay bekliyor{spent > 0 ? ` · ${usd(spent)}` : ''}</span>
          </div>
          {asking.map(task => <RaisedHand key={task.id} sim={sim} task={task} office={office} />)}
          <ul className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
            {sim.agents.map(agent => {
              const s = status(sim, agent);
              const task = sim.task(agent.taskId);
              return (
                <li key={agent.id} className={cn('cursor-pointer rounded-xl border bg-zinc-900/60 px-3 py-2 hover:border-zinc-600', filter === agent.id ? 'border-amber-500/60' : 'border-zinc-800')}
                  onClick={() => setFilter(f => (f === agent.id ? 'all' : agent.id))} title={`${agent.name} olaylarını göster`}>
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: agent.look.shirt }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{agent.name}</p>
                      <p className="truncate text-[11px] text-zinc-500">{agent.title}</p>
                    </div>
                    <span className={cn('flex items-center gap-1.5 text-right text-[11px] font-medium', TONE_TEXT[s.tone])}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[s.tone])} />
                      <span className="max-w-[150px] truncate">{s.text}</span>
                    </span>
                  </div>
                  {task && agent.phase === 'working' && (
                    <div className="mt-2">
                      <p className="truncate text-[11px] text-zinc-400">#{task.number} {task.title} · <span className="text-zinc-500">{decisionText(task)}</span></p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-amber-400" style={{ width: `${task.progress * 100}%` }} /></div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setComposing(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-amber-500/60 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/10">
            <Plus className="h-4 w-4" /> Görev ver
          </button>
        </section>

        <section className="flex min-h-[320px] flex-1 flex-col p-4 lg:min-h-0">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-400">Olaylar</h2>
          <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-900 p-1 text-[11px] font-semibold uppercase tracking-wide">
            {TABS.map(t => (
              <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={cn('relative rounded-lg py-2 text-zinc-400', tab === t.id && 'bg-zinc-800 text-zinc-100')}>
                {t.label}
                {t.id === 'delivery' && reviewing.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] text-white">{reviewing.length}</span>}
              </button>
            ))}
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Çalışana göre süz"
            className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200">
            <option value="all">Tüm çalışanlar</option>
            {sim.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="mt-1 max-h-[480px] min-h-0 flex-1 overflow-y-auto pr-1 lg:max-h-none">
            {tab === 'delivery' && <Deliveries sim={sim} office={office} />}
            <EventList sim={sim} events={events} empty={tab === 'delivery' ? (reviewing.length || sim.tasks.some(t => t.status === 'failed' || (t.status === 'approved' && t.remote)) ? '' : 'Teslim edilen iş yok.') : tab === 'technical' ? 'Çalışan biri olmadığında teknik kayıt oluşmaz.' : 'Henüz olay yok. Bir görev verin.'} />
          </div>
        </section>
      </aside>

      {composing && <TaskComposer sim={sim} office={office} onClose={() => setComposing(false)} />}
    </div>
  );
}

function EventList({ sim, events, empty }: { sim: OfficeSimulation; events: OfficeEvent[]; empty: string }) {
  if (!events.length) return empty ? <p className="mt-6 text-center text-xs text-zinc-500">{empty}</p> : null;
  return (
    <ol className="mt-2 space-y-0.5">
      {events.map(event => {
        const agent = sim.agent(event.agentId);
        return (
          <li key={event.id} className="flex gap-2.5 border-b border-zinc-800/70 py-2 text-xs">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: agent?.look.shirt ?? '#71717a' }} />
            <span className="flex-1 text-zinc-300">{event.text}</span>
            <span className="shrink-0 text-[10px] text-zinc-500">{ago(sim, event.at)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** A member of staff waiting at the desk with a hand up; the answer sends the work on. */
function RaisedHand({ sim, task, office }: { sim: OfficeSimulation; task: Task; office: Office }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const agent = sim.agent(task.agentId);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await office.act(task.id, { action: 'answer', answer }); setAnswer(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Cevap gönderilemedi.'); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mb-3 rounded-xl border border-sky-500/50 bg-sky-500/10 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-sky-200"><Hand className="h-3.5 w-3.5" /> {agent?.name} soruyor · #{task.number} {task.title}</p>
      <p className="mt-1 text-zinc-100">{task.remote?.question}</p>
      <div className="mt-2 flex gap-1.5">
        <input value={answer} onChange={e => { setAnswer(e.target.value); setError(''); }} placeholder="Cevabınız" aria-label={`${agent?.name ?? 'Çalışan'} için cevap`}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100" />
        <button type="submit" disabled={busy || !answer.trim()} className="rounded-lg bg-sky-600 px-2.5 font-semibold text-white disabled:opacity-50">Gönder</button>
      </div>
      {error && <p role="alert" className="mt-1 text-red-300">{error}</p>}
    </form>
  );
}

function Deliveries({ sim, office }: { sim: OfficeSimulation; office: Office }) {
  const [revising, setRevising] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const waiting = sim.tasks.filter(t => t.status === 'review');
  const failed = sim.tasks.filter(t => t.status === 'failed');
  const approved = sim.tasks.filter(t => t.status === 'approved' && t.remote).slice(-10).reverse();
  if (!waiting.length && !failed.length && !approved.length) return null;

  /** A real task goes to the server; a simulated one changes here. */
  const act = async (task: Task, body: Record<string, string>) => {
    setError('');
    if (!task.remote) {
      if (body.action === 'approve') sim.approve(task.id);
      if (body.action === 'revise') sim.requestRevision(task.id, body.note);
      return;
    }
    setBusy(task.id);
    try { await office.act(task.id, body); }
    catch (err) { setError(err instanceof Error ? err.message : 'İşlem tamamlanamadı.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="mt-3 space-y-2">
      {error && <p role="alert" className="rounded-lg border border-red-500/40 p-2 text-xs text-red-300">{error}</p>}
      {waiting.map(task => {
        const files = task.remote?.files.filter(f => f.revision === task.remote!.revisions) ?? [];
        const preview = files.find(f => f.contentType.startsWith('image/') && f.contentType !== 'image/svg+xml');
        return (
          <article key={task.id} className="rounded-xl border border-orange-500/40 bg-orange-500/5 p-3 text-xs">
            <p className="font-semibold text-zinc-100">#{task.number} {task.title}{task.revisions ? ` · revizyon ${task.revisions}` : ''}</p>
            <p className="mt-0.5 text-zinc-400">{sim.agent(task.agentId)?.name ?? CATEGORY[task.category].label} · {decisionText(task)}{task.remote ? ` · ${usd(task.remote.costUsd)}` : ''}</p>
            {preview && (
              <img src={preview.url} alt={`${task.title} önizleme`} className="mt-2 max-h-48 w-full rounded-lg border border-zinc-800 object-contain" />
            )}
            {files.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {files.map(f => (
                  <li key={f.id}>
                    <a href={`${f.url}?download=1`} className="inline-flex items-center gap-1.5 font-mono text-amber-200 underline-offset-2 hover:underline">
                      <Download className="h-3.5 w-3.5" /> {f.name} <span className="font-sans text-zinc-500">({Math.max(1, Math.round(f.size / 1024))} KB)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-zinc-300"><span className="font-mono">{task.deliverable?.name}</span> <span className="text-zinc-500">· örnek teslimat (simülasyon)</span></p>}
            {task.remote?.decision.review && (
              <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-900/60 p-2" role="status">
                <p className="font-semibold">{task.remote.decision.review.status === 'approved' ? 'Yönetici kontrolünden geçti' : 'İncelemeniz gerekiyor'}{task.remote.decision.review.score !== null ? ` · ${task.remote.decision.review.score}/10` : ''}</p>
                <p className="mt-1 text-zinc-300">{task.remote.decision.review.note}</p>
                {task.remote.decision.review.issues.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-200">{task.remote.decision.review.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
                {(task.remote.decision.review.suggestions?.length ?? 0) > 0 && <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-400" aria-label="Öneriler">{task.remote.decision.review.suggestions!.map((tip, i) => <li key={i}>Öneri: {tip}</li>)}</ul>}
                <p className="mt-1 text-zinc-400">Son onay size ait.</p>
              </div>
            )}
            {task.remote?.summary && <p className="mt-2 whitespace-pre-line text-zinc-300">{task.remote.summary}</p>}
            {revising === task.id ? (
              <form className="mt-2 flex gap-1.5" onSubmit={e => { e.preventDefault(); act(task, { action: 'revise', note }); setRevising(null); setNote(''); }}>
                <input autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder="Ne değişsin?" aria-label="Revizyon notu"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100" />
                <button type="submit" disabled={!note.trim()} className="rounded-lg bg-zinc-700 px-2.5 font-semibold disabled:opacity-50">Gönder</button>
                <button type="button" onClick={() => setRevising(null)} className="rounded-lg px-1.5 text-zinc-400" aria-label="Vazgeç"><X className="h-4 w-4" /></button>
              </form>
            ) : (
              <div className="mt-2 flex gap-1.5">
                <button type="button" disabled={busy === task.id} onClick={() => act(task, { action: 'approve' })} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" /> Onayla
                </button>
                <button type="button" disabled={busy === task.id} onClick={() => setRevising(task.id)} className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">
                  <Undo2 className="h-3.5 w-3.5" /> Revize iste
                </button>
              </div>
            )}
          </article>
        );
      })}
      {failed.map(task => (
        <article key={task.id} className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-xs">
          <p className="font-semibold text-zinc-100">#{task.number} {task.title}</p>
          <p className="mt-1 text-red-200">{task.remote?.error ?? 'İş tamamlanamadı.'}</p>
          {task.remote && (
            <button type="button" disabled={busy === task.id} onClick={() => act(task, { action: 'retry' })} className="mt-2 flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">
              <RefreshCw className="h-3.5 w-3.5" /> Yeniden dene
            </button>
          )}
        </article>
      ))}
      {approved.length > 0 && (
        <details className="rounded-xl border border-zinc-800 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-zinc-300">Onaylananlar ({approved.length})</summary>
          <ul className="mt-2 space-y-2">
            {approved.map(task => (
              <li key={task.id}>
                <p className="text-zinc-200">#{task.number} {task.title}</p>
                {task.remote!.files.filter(f => f.revision === task.remote!.revisions).map(f => (
                  <a key={f.id} href={`${f.url}?download=1`} className="mr-3 inline-flex items-center gap-1 font-mono text-amber-200 hover:underline"><Download className="h-3 w-3" />{f.name}</a>
                ))}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** A few tasks of different kinds, to show that plain words are enough. */
const EXAMPLES = [
  'Yeni pergola serisi için Instagram gönderisi tasarla',
  'Tedarikçi fiyatlarını karşılaştıran bir Excel tablosu hazırla',
  'Geciken teslimat için müşteriye özür e-postası yaz',
  'Bayi toplantısı için 8 slaytlık ürün sunumu hazırla',
  'Ürün kataloğu metnini İngilizceye çevir',
];

function TaskComposer({ sim, office, onClose }: { sim: OfficeSimulation; office: Office; onClose: () => void }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<TaskCategoryId | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const manager = sim.manager;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (text.trim().length < 3) return setError('Ne yapılması gerektiğini yazın.');
    setBusy(true);
    try {
      if (office.live) await office.create({ text, ...(category ? { category } : {}) });
      else if (category) sim.assign({ category, title: text.split(/\n/)[0].slice(0, 80), brief: text, triage: { by: 'rules', reason: 'türü görevi veren seçti' } });
      else sim.assignText(text);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görev verilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="office-task-title" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#11151f] p-5 text-zinc-100 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="office-task-title" className="text-lg font-semibold">Görev ver</h2>
            <p className="text-xs text-zinc-400">
              Ne yapılmasını istediğinizi yazın; {manager.name} okuyup işin türüne ve zorluğuna karar verir, uygun çalışana verir.
              {office.live ? ' İş gerçekten yapılır ve dosya olarak teslim edilir.' : ' Şu an simülasyon: gerçek dosya üretilmez.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800" aria-label="Kapat"><X className="h-5 w-5" /></button>
        </div>
        <label className="block text-xs font-semibold text-zinc-300" htmlFor="office-task-text">Ne yapılsın?</label>
        <textarea id="office-task-text" autoFocus value={text} rows={5} maxLength={8000}
          onChange={e => { setText(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          placeholder={'Örnek: Fuar standı için A1 afiş tasarla. Kurumsal renklerimiz lacivert ve turuncu, "Yeni Sezon Pergola" yazsın.'}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-relaxed" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map(example => (
            <button key={example} type="button" onClick={() => { setText(example); setError(''); }} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800">{example}</button>
          ))}
        </div>
        <details className="mt-4 rounded-xl border border-zinc-800 p-3 text-xs" open={category !== null}>
          <summary className="cursor-pointer font-semibold text-zinc-300">Türünü kendim seçeyim <span className="font-normal text-zinc-500">(isteğe bağlı)</span></summary>
          <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Görev türü">
            <button type="button" role="radio" aria-checked={category === null} onClick={() => setCategory(null)}
              className={cn('rounded-full border px-2.5 py-1', category === null ? 'border-amber-400 bg-amber-500/10 text-amber-100' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>Müdür karar versin</button>
            {TASK_CATEGORIES.map(id => (
              <button key={id} type="button" role="radio" aria-checked={category === id} onClick={() => setCategory(id)} title={CATEGORY[id].hint}
                className={cn('rounded-full border px-2.5 py-1', category === id ? 'border-amber-400 bg-amber-500/10 text-amber-100' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800')}>{CATEGORY[id].label}</button>
            ))}
          </div>
        </details>
        {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <span className="mr-auto hidden text-[11px] text-zinc-500 sm:block">Ctrl + Enter ile gönderin</span>
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Vazgeç</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-60">{busy ? `${manager.name} okuyor…` : 'Görevi ver'}</button>
        </div>
      </form>
    </div>
  );
}
