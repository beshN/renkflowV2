'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import type { CutView } from '@/lib/features/manufacturing/cut-view';
import { barColorMismatch } from '@/lib/features/colors/color-spec';
import { ColorChip } from '@/components/colors/ColorSwatch';
import { cn } from '@/lib/utils';

// One colour per job, plus its number written on every piece, so colour is never the only cue.
const JOB_COLORS = ['#4e6670', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#6b4a3a', '#4d7c0f', '#a21caf'];

type Job = { id: string; title: string; color?: string | null };

/**
 * A cutting plan drawn bar by bar: pieces along the bar in their job's colour and number, the saw
 * and trim loss hatched grey, a reusable remnant light grey. Tap a piece to see which job it is for.
 * Full screen on the workshop phone.
 */
export function CutDiagram({ plan, jobs, items, focusJobId, className }: {
  plan: CutView;
  jobs: Job[];
  items?: Array<{ id: string; name: string }>;
  focusJobId?: string;
  className?: string;
}) {
  const [full, setFull] = useState(false);
  const [picked, setPicked] = useState<{ bar: number; piece: number } | null>(null);
  const jobIndex = new Map(jobs.map((j, i) => [j.id, i]));
  const jobOf = (id: string) => jobs.find((j) => j.id === id);
  const pickedPiece = picked ? plan.bars[picked.bar]?.pieces[picked.piece] : null;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!full) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="İşler">
        {jobs.map((j, i) => (
          <span key={j.id} className={cn('inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5', focusJobId === j.id && 'border-primary')}>
            <span aria-hidden className="grid h-4 w-4 place-items-center rounded-sm text-[10px] font-bold text-white" style={{ background: JOB_COLORS[i % JOB_COLORS.length] }}>{i + 1}</span>
            <span className="max-w-[180px] truncate">{j.title}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1"><span aria-hidden className="h-3 w-4 rounded-sm bg-[repeating-linear-gradient(45deg,#a1a1aa_0_2px,transparent_2px_5px)]" />Fire</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden className="h-3 w-4 rounded-sm bg-zinc-300 dark:bg-zinc-600" />Artık</span>
      </div>
      <ol className="space-y-3">
        {plan.bars.map((bar, b) => {
          const mismatch = barColorMismatch(bar.color, bar.pieces.map((p) => jobOf(p.workOrderId)?.color));
          return (
            <li key={bar.id || b} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-semibold tabular-nums">{b + 1}.</span>
                  <span className="truncate">{items?.find((i) => i.id === bar.itemId)?.name ?? 'Profil'}</span>
                  <ColorChip color={bar.color} size={14} />
                  {bar.isRemnant && <span className="rounded border border-border px-1">artık çubuk</span>}
                  {mismatch && <span className="rounded border border-rose-500/40 px-1.5 font-medium text-rose-700 dark:text-rose-300">Renk uyuşmuyor</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{bar.lengthMm.toLocaleString('tr-TR')} mm</span>
              </div>
              <div className={cn('flex overflow-hidden rounded border border-border bg-muted', full ? 'h-16' : 'h-11')} role="group" aria-label={`Çubuk ${b + 1}`}>
                {bar.pieces.map((p, n) => {
                  // A piece of a job not in the list (another person's work) is grey, unnumbered.
                  const i = jobIndex.get(p.workOrderId);
                  const other = i === undefined;
                  const dim = focusJobId && focusJobId !== p.workOrderId;
                  const active = picked?.bar === b && picked.piece === n;
                  return (
                    <button key={n} type="button" onClick={() => setPicked(active ? null : { bar: b, piece: n })}
                      aria-label={other ? `Parça ${p.lengthMm} mm, başka iş` : `Parça ${p.lengthMm} mm, iş ${i + 1}: ${jobOf(p.workOrderId)?.title ?? ''}`}
                      className={cn('flex min-w-0 items-center justify-center border-r-2 border-background text-[11px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-ring', dim && 'opacity-35', active && 'ring-2 ring-inset ring-white')}
                      style={{ width: `${(p.lengthMm / bar.lengthMm) * 100}%`, background: other ? '#71717a' : JOB_COLORS[i % JOB_COLORS.length] }}>
                      <span className="truncate px-0.5">{other ? p.lengthMm : `${i + 1} · ${p.lengthMm}`}</span>
                    </button>
                  );
                })}
                <span aria-label={`Fire ${bar.lossMm} mm`} className="h-full bg-[repeating-linear-gradient(45deg,#a1a1aa_0_2px,transparent_2px_5px)]" style={{ width: `${(bar.lossMm / bar.lengthMm) * 100}%` }} />
                {bar.remainingMm > 0 && (
                  <span className={cn('grid h-full min-w-0 place-items-center text-[10px]', bar.reusable ? 'bg-zinc-300 text-zinc-800 dark:bg-zinc-600 dark:text-zinc-100' : 'bg-[repeating-linear-gradient(45deg,#a1a1aa_0_2px,transparent_2px_5px)]')}
                    style={{ width: `${(bar.remainingMm / bar.lengthMm) * 100}%` }} aria-label={`${bar.reusable ? 'Artık' : 'Fire'} ${bar.remainingMm} mm`}>
                    <span className="truncate">{bar.remainingMm}</span>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {pickedPiece && (
        <p role="status" className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <strong className="tabular-nums">{pickedPiece.lengthMm.toLocaleString('tr-TR')} mm</strong> · {jobOf(pickedPiece.workOrderId)?.title ?? 'Başka iş'}
        </p>
      )}
    </div>
  );

  if (full)
    return (
      <div className="fixed inset-0 z-[90] overflow-y-auto bg-background p-4" role="dialog" aria-modal="true" aria-label="Kesim şeması">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kesim şeması</h2>
          <button ref={closeRef} type="button" onClick={() => setFull(false)} aria-label="Tam ekrandan çık" className="grid h-12 w-12 place-items-center rounded-md border border-border"><X size={22} /></button>
        </div>
        {body}
      </div>
    );
  return (
    <section className={cn('min-w-0 space-y-2', className)} aria-label="Kesim şeması">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Kesim şeması{plan.wastePercent !== null && <span className="ml-2 text-xs font-normal text-muted-foreground">fire %{plan.wastePercent.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</span>}</h3>
        <button type="button" onClick={() => setFull(true)} aria-label="Tam ekran" className="grid h-10 w-10 place-items-center rounded-md border border-border"><Maximize2 size={18} /></button>
      </div>
      {body}
    </section>
  );
}
