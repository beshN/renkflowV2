'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Check, Moon, Pause, Play, Plus, RotateCcw, Sun, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY, TASK_CATEGORIES, type TaskCategoryId } from '@/lib/features/office/catalog';
import { DIFFICULTY_LABELS } from '@/lib/features/office/routing';
import { OfficeSimulation, type Agent, type EventKind, type OfficeEvent, type Task } from '@/lib/features/office/simulation';
import { createOfficeStage, type OfficeStage } from '@/lib/features/office/scene';

const SPEEDS = [1, 2, 4];
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
    case 'briefing': return { text: 'Görevi anlatıyor', tone: 'busy' };
    case 'to_office': return { text: 'Masasına dönüyor', tone: 'move' };
    case 'called': return { text: 'Yönetici geliyor', tone: 'move' };
    case 'to_desk': return { text: 'Masaya gidiyor', tone: 'move' };
    case 'working': return { text: `${CATEGORY[task!.category].steps[Math.max(0, task!.step)]} · %${Math.floor(task!.progress * 100)}`, tone: 'busy' };
    case 'delivering': return { text: 'Teslim ediyor', tone: 'done' };
    case 'to_lounge': return { text: 'Molaya dönüyor', tone: 'move' };
    default: return { text: 'Dinleniyor', tone: 'idle' };
  }
}

/** The manager's call in a few words, e.g. "Orta · Claude Sonnet 5.5". */
const decisionText = (task: Task) => task.decision ? `${DIFFICULTY_LABELS[task.decision.difficulty]} · ${task.decision.model.label}` : '';

const TONE_DOT = { idle: 'bg-zinc-500', busy: 'bg-amber-400', move: 'bg-sky-400', done: 'bg-emerald-400' };
const TONE_TEXT = { idle: 'text-zinc-400', busy: 'text-amber-300', move: 'text-sky-300', done: 'text-emerald-300' };

export function OfficeWorkspace() {
  const [sim] = useState(() => new OfficeSimulation());
  useSyncExternalStore(sim.subscribe, sim.getVersion, sim.getVersion);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<OfficeStage | null>(null);
  const labels = useRef(new Map<string, HTMLElement>());
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [night, setNight] = useState(true);
  const [failed, setFailed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [tab, setTab] = useState<EventKind>('activity');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!canvas.current) return;
    try {
      stage.current = createOfficeStage(canvas.current, sim, labels.current);
    } catch {
      setFailed(true);
      return;
    }
    return () => { stage.current?.dispose(); stage.current = null; };
  }, [sim]);
  useEffect(() => stage.current?.setSpeed(speed), [speed]);
  useEffect(() => stage.current?.setPaused(paused), [paused]);
  useEffect(() => stage.current?.setNight(night), [night]);

  const reviewing = sim.tasks.filter(t => t.status === 'review');
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
                {/* A called person's bubble would sit under the manager's; the panel still shows it. */}
                {agent.phase !== 'lounge' && agent.phase !== 'called' && (
                  <span className="max-w-[220px] truncate rounded-full border border-amber-400/60 bg-zinc-950/85 px-2.5 py-1 text-[11px] font-medium text-amber-100 shadow">{s.text}</span>
                )}
                <span className="rounded-md bg-zinc-950/75 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-200">{agent.name}</span>
              </div>
            );
          })}
        </div>
        <div className="absolute left-3 top-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-1.5">Simülasyon · modeller henüz bağlı değil</span>
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
            <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] text-zinc-300">{working} çalışıyor · {reviewing.length} onay bekliyor</span>
          </div>
          <ul className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
            {sim.agents.map(agent => {
              const s = status(sim, agent);
              const task = sim.task(agent.taskId);
              return (
                <li key={agent.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
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
            {tab === 'delivery' && <Deliveries sim={sim} />}
            <EventList sim={sim} events={events} empty={tab === 'delivery' ? (reviewing.length ? '' : 'Teslim edilen iş yok.') : tab === 'technical' ? 'Çalışan biri olmadığında teknik kayıt oluşmaz.' : 'Henüz olay yok. Bir görev verin.'} />
          </div>
        </section>
      </aside>

      {composing && <TaskComposer sim={sim} onClose={() => setComposing(false)} />}
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

function Deliveries({ sim }: { sim: OfficeSimulation }) {
  const [revising, setRevising] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const waiting = sim.tasks.filter(t => t.status === 'review');
  if (!waiting.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {waiting.map(task => (
        <li key={task.id} className="rounded-xl border border-orange-500/40 bg-orange-500/5 p-3 text-xs">
          <p className="font-semibold text-zinc-100">#{task.number} {task.title}</p>
          <p className="mt-0.5 text-zinc-400">{sim.agent(task.agentId)?.name} · {task.deliverable?.kind}: <span className="font-mono text-zinc-300">{task.deliverable?.name}</span></p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Yöneticinin kararı: {decisionText(task)}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Örnek teslimat: dosya, model bağlandığında üretilecek.</p>
          {revising === task.id ? (
            <form className="mt-2 flex gap-1.5" onSubmit={e => { e.preventDefault(); sim.requestRevision(task.id, note); setRevising(null); setNote(''); }}>
              <input autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder="Ne değişsin?" aria-label="Revizyon notu"
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-100" />
              <button type="submit" className="rounded-lg bg-zinc-700 px-2.5 font-semibold">Gönder</button>
              <button type="button" onClick={() => setRevising(null)} className="rounded-lg px-1.5 text-zinc-400" aria-label="Vazgeç"><X className="h-4 w-4" /></button>
            </form>
          ) : (
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={() => sim.approve(task.id)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-500">
                <Check className="h-3.5 w-3.5" /> Onayla
              </button>
              <button type="button" onClick={() => setRevising(task.id)} className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 font-semibold text-zinc-200 hover:bg-zinc-800">
                <Undo2 className="h-3.5 w-3.5" /> Revize iste
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function TaskComposer({ sim, onClose }: { sim: OfficeSimulation; onClose: () => void }) {
  const [category, setCategory] = useState<TaskCategoryId>('design');
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [error, setError] = useState('');
  const chosen = CATEGORY[category];
  const owner = sim.agents.find(a => a.role === category);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      sim.assign({ category, title, brief });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görev verilemedi.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="office-task-title" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-[#11151f] p-5 text-zinc-100 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="office-task-title" className="text-lg font-semibold">Görev ver</h2>
            <p className="text-xs text-zinc-400">Türünü seçin; o işin uzmanı masaya oturup çalışmaya başlar.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800" aria-label="Kapat"><X className="h-5 w-5" /></button>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Görev türü</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TASK_CATEGORIES.map(id => (
              <label key={id} className={cn('cursor-pointer rounded-xl border p-2.5 text-xs', category === id ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-800 hover:border-zinc-600')}>
                <input type="radio" name="category" value={id} checked={category === id} onChange={() => setCategory(id)} className="sr-only" />
                <span className="block font-semibold text-zinc-100">{CATEGORY[id].label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-400">{CATEGORY[id].hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-3 text-xs text-zinc-400">Üstlenecek: <span className="font-semibold text-zinc-200">{owner?.name}</span> ({owner?.title}) · Çıktı: {chosen.output.kind} (.{chosen.output.extension}) · Zorluğa göre modeli ofis müdürü seçer</p>
        <label className="mt-4 block text-xs font-semibold text-zinc-300" htmlFor="office-task-name">Başlık</label>
        <input id="office-task-name" value={title} onChange={e => { setTitle(e.target.value); setError(''); }} placeholder={chosen.examples[0]}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chosen.examples.map(example => (
            <button key={example} type="button" onClick={() => { setTitle(example); setError(''); }} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800">{example}</button>
          ))}
        </div>
        <label className="mt-4 block text-xs font-semibold text-zinc-300" htmlFor="office-task-brief">Ayrıntılar</label>
        <textarea id="office-task-brief" value={brief} onChange={e => setBrief(e.target.value)} rows={3} placeholder="Ölçü, ton, hedef kitle, kaynak dosya…"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm" />
        {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Vazgeç</button>
          <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">Görevi ver</button>
        </div>
      </form>
    </div>
  );
}
