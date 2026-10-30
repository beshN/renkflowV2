'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, FileSpreadsheet, FileText, Languages, Mail, RotateCcw, ShieldCheck } from 'lucide-react';
import { CATEGORY, STAFF, type TaskCategoryId } from '@/lib/features/office/catalog';
import { decide, DIFFICULTY_LABELS, MISSING_NOTE } from '@/lib/features/office/routing';
import { triageByRules } from '@/lib/features/office/triage';
import { cn } from '@/lib/utils';
import { fmt, mm, ORDERS, planOrder, tl } from './model';
import { EASE, T } from './primitives';

/**
 * The AI office, drawn as a floor plan. The manager reads the task with the office's own triage
 * rules and difficulty call, personal data is masked before any model sees it, the worker's steps
 * are the category's steps, the manager checks the file against the task (pass mark 7, one automatic
 * fix), and the person gives the final approval. Here the work itself is played back with sample
 * data; in the product the workers are language models working on the company's records.
 */

const SUGGESTIONS = [
  'RF-1042 için Kıyı Kafe’ye montaj tarihini bildiren bir e-posta yaz.',
  'Açık siparişlerin KDV dahil tutarlarını Excel tablosuna dök, toplamını al.',
  'Bioklimatik pergola tanıtım metnini İngilizceye çevir.',
];

// Floor plan: manager at the head of the room, eight desks in two rows, the lounge on the right.
const DESKS: Record<string, { x: number; y: number }> = {
  manager: { x: 64, y: 40 },
  deniz: { x: 40, y: 150 }, elif: { x: 140, y: 150 }, murat: { x: 240, y: 150 }, zeynep: { x: 340, y: 150 },
  kerem: { x: 40, y: 250 }, selin: { x: 140, y: 250 }, can: { x: 240, y: 250 }, aylin: { x: 340, y: 250 },
};
const seat = (id: string) => ({ x: DESKS[id].x + 34, y: DESKS[id].y + 46 });

type Phase = 'idle' | 'triage' | 'mask' | 'search' | 'work' | 'review' | 'fix' | 'approval' | 'done';
type Run = { text: string; category: TaskCategoryId; worker: (typeof STAFF)[number]; revisions: number };

const NAMES = Array.from(new Set([...ORDERS.map((o) => o.customer), ...ORDERS.map((o) => o.owner), 'Hakan T.']));
function mask(text: string) {
  let n = 0;
  const map: Record<string, string> = {};
  const out = NAMES.reduce((acc, name) => (acc.includes(name) ? acc.split(name).join((map[name] ??= `[KİŞİ_${++n}]`)) : acc), text);
  return { out, count: n };
}

export function AIOffice() {
  const reduce = useReducedMotion();
  const [text, setText] = useState(SUGGESTIONS[0]);
  const [run, setRun] = useState<Run | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<string>('murat');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  const at = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, reduce ? Math.min(ms, 400) : ms)); };

  const start = (revisions = 0, base?: Run) => {
    clear();
    const triage = triageByRules(base?.text ?? text);
    const worker = STAFF.find((s) => s.role === triage.category) ?? STAFF[2];
    const next: Run = base ? { ...base, revisions } : { text: text.trim(), category: triage.category, worker, revisions };
    if (!next.text) return;
    setRun(next);
    setStep(0);
    setPhase('triage');
    const steps = CATEGORY[next.category].steps.length;
    const fails = next.category === 'spreadsheet' && revisions === 0;
    let t = 900;
    at(t, () => setPhase('mask')); t += 1000;
    at(t, () => setPhase('search')); t += 1000;
    at(t, () => setPhase('work'));
    for (let i = 1; i < steps; i++) at(t + i * 650, () => setStep(i));
    t += steps * 650 + 300;
    at(t, () => setPhase('review')); t += 1300;
    if (fails) { at(t, () => setPhase('fix')); t += 1700; }
    at(t, () => setPhase('approval'));
  };
  const reset = () => { clear(); setRun(null); setPhase('idle'); };

  const decision = useMemo(() => (run ? decide({ category: run.category, title: run.text, brief: run.text, revisions: run.revisions }) : null), [run]);
  const masked = useMemo(() => (run ? mask(run.text) : null), [run]);
  const order = run ? ORDERS.find((o) => run.text.includes(o.id)) : undefined;
  const order_ = run && /sipariş|tahsilat|tutar/i.test(run.text) && !order ? ORDERS : null;
  const reached = (p: Phase) => ORDER_OF[phase] >= ORDER_OF[p];
  const busy = phase !== 'idle' && phase !== 'approval' && phase !== 'done';
  const where = !run ? null : phase === 'work' || phase === 'fix' ? run.worker.id : phase === 'triage' || phase === 'review' || phase === 'mask' || phase === 'search' ? 'manager' : null;

  return (
    <div className="x-window grid text-[var(--x-ink)] lg:grid-cols-[1.1fr_1fr]">
      {/* Floor plan */}
      <div className="relative border-b border-[var(--x-line)] bg-[var(--x-surface-sunk)] lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-[var(--x-line)] px-5 py-3 text-[12px]">
          <span className="font-medium">AI ofis</span>
          <span className="text-[var(--x-muted)]">{!run || !busy ? (phase === 'approval' ? 'Teslim onayınızı bekliyor' : '8 çalışan · 1 müdür') : phase === 'work' || phase === 'fix' ? `${run.worker.name} çalışıyor` : phase === 'review' ? 'Kaan teslimi kontrol ediyor' : 'Kaan görevi okuyor'}</span>
        </div>
        <svg viewBox="0 0 540 350" className="block h-auto w-full" role="img" aria-label={run ? `${run.worker.name} (${run.worker.title}) görevi aldı` : 'AI ofis kat planı'}>
          <defs>
            <pattern id="rfx-floor" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--x-line)" strokeWidth="0.6" /></pattern>
          </defs>
          <rect x="16" y="16" width="508" height="318" rx="6" fill="url(#rfx-floor)" stroke="var(--x-line-strong)" />
          {/* lounge */}
          <rect x="440" y="140" width="72" height="182" rx="4" fill="var(--x-surface)" stroke="var(--x-line)" />
          <text x="476" y="160" textAnchor="middle" fontSize="10" fill="var(--x-faint)">Mola</text>
          <circle cx="462" cy="200" r="9" fill="none" stroke="var(--x-line-strong)" /><circle cx="490" cy="230" r="9" fill="none" stroke="var(--x-line-strong)" />
          <rect x="452" y="270" width="48" height="18" rx="3" fill="none" stroke="var(--x-line-strong)" />
          <text x="476" y="306" textAnchor="middle" fontSize="9" fill="var(--x-faint)">kahve</text>
          {/* task board by the manager */}
          <rect x="190" y="44" width="150" height="40" rx="3" fill="var(--x-surface)" stroke="var(--x-line)" />
          <text x="200" y="60" fontSize="9" fill="var(--x-faint)">Görev panosu</text>
          <text x="200" y="75" fontSize="10" fill="var(--x-ink-2)">{run ? (phase === 'done' ? 'Teslim edildi' : phase === 'approval' ? 'Onayınızı bekliyor' : CATEGORY[run.category].label) : 'Boş'}</text>

          {STAFF.map((person) => {
            const d = DESKS[person.id];
            if (!d) return null;
            const s = seat(person.id);
            const mine = run?.worker.id === person.id;
            const active = where === person.id;
            const isManager = person.id === 'manager';
            return (
              <g key={person.id} role="button" tabIndex={busy ? -1 : 0} aria-label={`${person.name}, ${person.title}`} aria-pressed={focus === person.id} onClick={() => !busy && setFocus(person.id)} onKeyDown={(e) => { if (!busy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setFocus(person.id); } }} className={cn('outline-none [&:focus-visible>rect:first-child]:stroke-[var(--x-bronze-fill)]', !busy && 'cursor-pointer')}>
                <rect x={d.x} y={d.y} width={isManager ? 100 : 68} height={30} rx={3} fill="var(--x-surface)" stroke={active ? 'var(--x-bronze-fill)' : 'var(--x-line-strong)'} strokeWidth={active ? 1.5 : 1} />
                <motion.rect x={d.x + (isManager ? 34 : 18)} y={d.y + 6} width={32} height={12} rx={2} initial={false} animate={{ fill: active ? 'var(--x-bronze-fill)' : 'var(--x-surface-sunk)', opacity: active && !reduce ? [1, 0.55, 1] : 1 }} transition={active && !reduce ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : T.base} stroke="var(--x-line-strong)" strokeWidth={0.6} />
                {focus === person.id && !run && <circle cx={isManager ? d.x + 50 : s.x} cy={s.y} r={14} fill="none" stroke="var(--x-bronze-fill)" strokeWidth={1.5} />}
                <circle cx={isManager ? d.x + 50 : s.x} cy={s.y} r={10} fill={mine || isManager ? 'var(--x-ink-2)' : 'var(--x-surface)'} stroke="var(--x-line-strong)" />
                <text x={isManager ? d.x + 50 : s.x} y={s.y + 3.5} textAnchor="middle" fontSize="10" fontWeight={600} fill={mine || isManager ? 'var(--x-surface)' : 'var(--x-muted)'}>{person.name[0]}</text>
                <text x={isManager ? d.x + 50 : s.x} y={s.y + 24} textAnchor="middle" fontSize="9.5" fill={mine ? 'var(--x-ink)' : 'var(--x-faint)'} fontWeight={mine ? 600 : 400}>{person.name}</text>
              </g>
            );
          })}

          {/* the file travelling between manager and worker */}
          <AnimatePresence>
            {run && (phase === 'triage' || phase === 'work' || phase === 'review' || phase === 'fix') && (() => {
              const m = { x: DESKS.manager.x + 50, y: DESKS.manager.y + 15 }, w = { x: DESKS[run.worker.id].x + 34, y: DESKS[run.worker.id].y + 15 };
              const toWorker = phase === 'triage' || phase === 'fix';
              const [from, to] = toWorker ? [m, w] : [w, m];
              return (
                <motion.g key={phase} initial={{ x: from.x, y: from.y, opacity: 0 }} animate={{ x: to.x, y: to.y, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.8, ease: EASE }}>
                  <rect x={-7} y={-9} width={14} height={18} rx={2} fill="var(--x-surface)" stroke="var(--x-bronze-fill)" strokeWidth={1.4} />
                  <path d="M-3 -3H3M-3 1H3M-3 5H1" stroke="var(--x-bronze-fill)" strokeWidth={1} />
                </motion.g>
              );
            })()}
          </AnimatePresence>
        </svg>
        <p className="px-5 pb-4 text-[11.5px] leading-5 text-[var(--x-faint)]">Bir çalışana tıklayın: ne yaptığını ve ona verilebilecek örnek işleri görün. Bu sayfada iş, örnek veriyle canlandırılır.</p>
        <AnimatePresence mode="wait">
          {run && reached('approval') ? (
            <motion.div key="file" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={T.slow} className="border-t border-[var(--x-line)] px-5 py-4">
              <Deliverable run={run} />
            </motion.div>
          ) : !run ? (
            <motion.div key={focus} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={T.base} className="border-t border-[var(--x-line)] px-5 py-4">
              <Profile id={focus} onPick={(t) => setText(t)} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Task and its trail */}
      <div className="flex min-h-[520px] flex-col bg-[var(--x-surface)]">
        <div className="border-b border-[var(--x-line)] px-5 py-4">
          <label htmlFor="rfx-task" className="text-[12px] font-medium">Göreviniz</label>
          <textarea id="rfx-task" rows={2} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} className="mt-2 w-full resize-none rounded-[var(--x-r-control)] bg-[var(--x-surface)] px-3 py-2 text-[13px] leading-5 shadow-[inset_0_0_0_1px_var(--x-line)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_var(--x-ink-2)] focus-visible:outline-none disabled:text-[var(--x-muted)]" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s, i) => (
              <button key={s} type="button" disabled={busy} onClick={() => setText(s)} className={cn('rounded-full px-2.5 py-1 text-[11.5px] transition-colors duration-[120ms] disabled:opacity-50', text === s ? 'bg-[var(--x-ink)] text-[var(--x-surface)]' : 'text-[var(--x-ink-2)] shadow-[inset_0_0_0_1px_var(--x-line)] hover:bg-[var(--x-surface-hover)]')}>
                {['Müşteri e-postası', 'Excel tablosu', 'Çeviri'][i]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-[var(--x-faint)]">Ne istediğinizi kendi cümlenizle yazın.</span>
            {phase === 'idle' || phase === 'done' ? (
              <button type="button" onClick={() => start()} disabled={!text.trim()} className="x-ctl x-ctl-ink">Görevi ver</button>
            ) : (
              <button type="button" onClick={reset} className="x-ctl"><RotateCcw size={12} aria-hidden /> Sıfırla</button>
            )}
          </div>
        </div>

        <ol className="flex-1 space-y-0 px-5 py-4 text-[12.5px]" aria-live="polite">
          {!run && <li className="py-6 text-center text-[12.5px] text-[var(--x-muted)]">Bir görev seçin ya da yazın, ardından <b className="font-medium text-[var(--x-ink)]">Görevi ver</b>’e basın.</li>}
          {run && decision && (
            <>
              <Trail show done={reached('mask')} title="Kaan görevi okudu">
                {CATEGORY[run.category].label} · {DIFFICULTY_LABELS[decision.difficulty]} · {run.worker.name}, {run.worker.title.toLocaleLowerCase('tr')}
                {decision.reasons.length > 0 && <span className="block text-[var(--x-faint)]">Gerekçe: {decision.reasons.join(', ')}{run.revisions ? ` · revizyon ${run.revisions}` : ''}</span>}
                {decision.missing.map((m) => MISSING_NOTE[m] && <span key={m} className="block text-[var(--x-st-approval)]">Not: {MISSING_NOTE[m]}.</span>)}
              </Trail>
              <Trail show={reached('mask')} done={reached('search')} title="Kişisel veriler maskelendi" icon={<ShieldCheck size={12} aria-hidden />}>
                <span className="x-mono block truncate text-[11.5px] text-[var(--x-ink-2)]">{masked!.out}</span>
                <span className="block text-[var(--x-faint)]">{masked!.count ? `${masked!.count} ad yer tutucuyla değişti; teslimde geri konur.` : 'Görevde kişisel veri bulunmadı.'}</span>
              </Trail>
              <Trail show={reached('search')} done={reached('work')} title="Firma kayıtlarına bakıldı">
                {order ? `Siparişler: ${order.id} · termin ${order.due} · ${order.owner}` : order_ ? `Siparişler: ${ORDERS.length} kayıt (yalnız okunur)` : 'Bu iş için kayıt araması gerekmedi.'}
              </Trail>
              <Trail show={reached('work')} done={reached('review')} title={`${run.worker.name} çalışıyor`}>
                {CATEGORY[run.category].steps[Math.min(step, CATEGORY[run.category].steps.length - 1)]}
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--x-line)]"><motion.span className="block h-full rounded-full bg-[var(--x-bronze-fill)]" initial={false} animate={{ width: reached('review') ? '100%' : `${((step + 1) / CATEGORY[run.category].steps.length) * 100}%` }} transition={T.slow} /></span>
              </Trail>
              {run.category === 'spreadsheet' && run.revisions === 0 ? (
                <>
                  <Trail show={reached('review')} done={reached('fix')} title={reached('fix') ? 'Kaan kontrol etti · 5/10' : 'Kaan dosyayı görevle karşılaştırıyor'} tone={reached('fix') ? 'warn' : undefined}>
                    {reached('fix') ? 'Sorun: toplam satırı KDV hariç tutarları topluyor, sütun KDV dahil. Bir kez otomatik düzeltmeye gönderildi.' : 'Hesaplar, eksik kalem ve biçim inceleniyor.'}
                  </Trail>
                  <Trail show={reached('fix')} done={reached('approval')} title={reached('approval') ? 'Kaan yeniden kontrol etti · 9/10, geçti' : `${run.worker.name} düzeltiyor`}>
                    {reached('approval') ? `Öneri: ${SUGGEST.spreadsheet}` : 'Toplam formülü KDV dahil sütuna bağlanıyor.'}
                  </Trail>
                </>
              ) : (
                <Trail show={reached('review')} done={reached('approval')} title={reached('approval') ? 'Kaan kontrol etti · 8/10, geçti' : 'Kaan dosyayı görevle karşılaştırıyor'}>
                  {reached('approval') ? `Öneri: ${SUGGEST[run.category] ?? 'dosya adını tarihle başlatın.'}` : 'Doğruluk, eksik bilgi ve biçim inceleniyor.'}
                </Trail>
              )}
              <Trail show={reached('approval')} done={phase === 'done'} title={phase === 'done' ? 'Teslim alındı' : 'Son onay sizde'}>
                {phase === 'done' ? 'Dosya görevin kartında; gerçek adlar dosyaya geri kondu.' : 'Dosyayı inceleyin, onaylayın ya da revizyon isteyin.'}
              </Trail>
            </>
          )}
        </ol>

        <AnimatePresence>
          {run && reached('approval') && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={T.slow} className="border-t border-[var(--x-line)] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
                {phase === 'done' ? (
                  <span className="flex items-center gap-1.5 font-medium text-[var(--x-ok)]"><Check size={13} aria-hidden /> Teslim alındı.</span>
                ) : (
                  <>
                    <span className="text-[var(--x-muted)]">Müdür onayı sizin onayınızın yerine geçmez.</span>
                    <span className="flex gap-2">
                      <button type="button" className="x-ctl" onClick={() => start(run.revisions + 1, run)}>Revizyon iste</button>
                      <button type="button" className="x-ctl x-ctl-ink" onClick={() => setPhase('done')}>Teslimi onayla</button>
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Who sits at the desk and what to hand them; an example fills the task box. */
function Profile({ id, onPick }: { id: string; onPick: (task: string) => void }) {
  const person = STAFF.find((p) => p.id === id)!;
  if (person.role === 'manager') {
    return (
      <div>
        <p className="text-[13px] font-medium">{person.name} <span className="font-normal text-[var(--x-muted)]">{person.title}</span></p>
        <p className="mt-1 text-[12.5px] leading-5 text-[var(--x-ink-2)]">Görevin türünü ve zorluğunu belirler, doğru çalışana verir. Teslim edilen Word, Excel, PowerPoint, PDF ya da görselin içeriğini görevle karşılaştırır; 7’nin altındaki teslimi bir kez düzeltmeye gönderir, sorun sürerse kararı size bırakır.</p>
      </div>
    );
  }
  const c = CATEGORY[person.role];
  return (
    <div>
      <p className="flex items-baseline justify-between gap-3 text-[13px] font-medium"><span>{person.name} <span className="font-normal text-[var(--x-muted)]">{person.title}</span></span><span className="text-[11.5px] font-normal text-[var(--x-faint)]">{c.output.kind} · .{c.output.extension}</span></p>
      <p className="mt-1 text-[12.5px] text-[var(--x-ink-2)]">{c.hint}.</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {c.examples.map((e) => <button key={e} type="button" onClick={() => onPick(`${e}.`)} className="rounded-full px-2.5 py-1 text-left text-[11.5px] text-[var(--x-ink-2)] shadow-[inset_0_0_0_1px_var(--x-line)] transition-colors duration-[120ms] hover:bg-[var(--x-surface-hover)]">{e}</button>)}
      </div>
    </div>
  );
}

const ORDER_OF: Record<Phase, number> = { idle: 0, triage: 1, mask: 2, search: 3, work: 4, review: 5, fix: 6, approval: 7, done: 8 };
const SUGGEST: Partial<Record<TaskCategoryId, string>> = {
  correspondence: 'konu satırına sipariş numarası eklenebilir.',
  spreadsheet: 'tutar sütununa binlik ayırıcı biçimi verilebilir.',
  translation: '“bioclimatic” terimi katalogdaki yazımla aynı tutuldu.',
};

function Trail({ show, done, title, children, icon, tone }: { show: boolean; done: boolean; title: string; children: React.ReactNode; icon?: React.ReactNode; tone?: 'warn' }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.li initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={T.slow} className="overflow-hidden">
          <div className="grid grid-cols-[18px_1fr] gap-3 pb-3">
            <span className="relative flex justify-center pt-0.5">
              <span className={cn('grid h-4 w-4 place-items-center rounded-full', done ? (tone === 'warn' ? 'bg-[var(--x-st-approval)] text-white' : 'bg-[var(--x-ink-2)] text-[var(--x-surface)]') : 'shadow-[inset_0_0_0_1.5px_var(--x-bronze-fill)]')}>
                {done ? <Check size={9} strokeWidth={3} aria-hidden /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--x-bronze-fill)] motion-reduce:animate-none" />}
              </span>
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-medium">{icon}{title}</p>
              <div className="mt-0.5 text-[12px] leading-5 text-[var(--x-muted)]">{children}</div>
            </div>
          </div>
        </motion.li>
      )}
    </AnimatePresence>
  );
}

function Deliverable({ run }: { run: Run }) {
  const order = ORDERS.find((o) => run.text.includes(o.id)) ?? ORDERS[0];
  const out = CATEGORY[run.category].output;
  const head = (Icon: typeof Mail, name: string) => <p className="mb-2 flex items-center gap-2 text-[12px] font-medium"><Icon size={13} className="text-[var(--x-muted)]" aria-hidden />{name}</p>;
  if (run.category === 'correspondence') {
    return (
      <div>
        {head(Mail, 'E-posta taslağı')}
        <div className="rounded-[var(--x-r-panel)] bg-[var(--x-surface-sunk)] px-3.5 py-3 text-[12px] leading-5 shadow-[inset_0_0_0_1px_var(--x-line)]">
          <p className="text-[var(--x-muted)]">Konu: <span className="text-[var(--x-ink)]">{order.id} pergola montaj tarihi</span></p>
          <p className="mt-2">Merhaba {order.customer} ekibi,</p>
          <p className="mt-1.5 text-[var(--x-ink-2)]">{fmt(order.spec.widthMm)} × {fmt(order.spec.projectionMm)} mm, {order.spec.color} bioklimatik pergolanızın kesimi tamamlandı. Montaj ekibimiz {order.due} tarihinde {order.city}’daki adresinizde olacak. Uygun değilse bu e-postayı yanıtlamanız yeterli.</p>
          <p className="mt-1.5">{order.owner}, Ege Alüminyum</p>
        </div>
      </div>
    );
  }
  if (run.category === 'spreadsheet') {
    const rows = ORDERS.filter((o) => o.stage !== 'delivery').map((o) => ({ o, total: planOrder(o.spec, o.id).totals.totalAmount }));
    return (
      <div>
        {head(FileSpreadsheet, 'acik-siparisler.xlsx')}
        <table className="w-full overflow-hidden rounded-[var(--x-r-panel)] text-[11.5px] shadow-[inset_0_0_0_1px_var(--x-line)]">
          <tbody>
            {rows.slice(0, 4).map(({ o, total }) => <tr key={o.id} className="border-b border-[var(--x-line)]"><td className="x-mono px-2.5 py-1.5 text-[var(--x-bronze)]">{o.id}</td><td className="px-2.5">{o.customer}</td><td className="x-num px-2.5 text-right">{tl(total)}</td></tr>)}
            <tr className="text-[var(--x-faint)]"><td className="px-2.5 py-1.5" colSpan={3}>+{rows.length - 4} satır</td></tr>
            <tr className="bg-[var(--x-surface-sunk)] font-semibold"><td className="px-2.5 py-1.5" colSpan={2}>Toplam, KDV dahil</td><td className="x-num px-2.5 text-right">{tl(rows.reduce((n, r) => n + r.total, 0))}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (run.category === 'translation') {
    return (
      <div>
        {head(Languages, 'pergola-tanitim-en.docx')}
        <div className="grid grid-cols-2 gap-3 rounded-[var(--x-r-panel)] bg-[var(--x-surface-sunk)] px-3.5 py-3 text-[12px] leading-5 shadow-[inset_0_0_0_1px_var(--x-line)]">
          <p className="text-[var(--x-muted)]">Motorlu lameller güneşe ve yağmura göre açılır; dere kanalı suyu dikmelerden tahliye eder.</p>
          <p>Motorised louvres open to sun and rain; the gutter channel drains water through the posts.</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      {head(FileText, `${run.text.slice(0, 32).trim().toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]+/gi, '-').replace(/-+$/, '')}.${out.extension}`)}
      <p className="text-[12px] text-[var(--x-muted)]">{out.kind} · {CATEGORY[run.category].steps.length} adımda hazırlandı · ilgili sipariş {order.id}, {mm(order.spec.widthMm)}</p>
    </div>
  );
}
