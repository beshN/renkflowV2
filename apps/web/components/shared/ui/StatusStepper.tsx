'use client';

import { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Status configuration type
// ============================================

export interface StatusStep {
  key: string;
  label: string;
  shortLabel?: string;
  description?: string;
  color?: string; // Tailwind color class
}

export interface StatusStepperProps {
  steps: StatusStep[];
  currentStatus: string;
  onTransition?: (newStatus: string) => void | Promise<void>;
  isTransitioning?: boolean;
  allowedTransitions?: string[];
  className?: string;
  compact?: boolean;
}

// ============================================
// Default Renk Alüminyum order statuses
// ============================================

export const ORDER_STATUS_STEPS: StatusStep[] = [
  { key: 'new', label: 'Yeni', shortLabel: 'Yeni', color: 'blue' },
  { key: 'pending_approval', label: 'Onay bekliyor', shortLabel: 'Onay', color: 'amber' },
  { key: 'approved', label: 'Onaylandı', shortLabel: 'Onaylı', color: 'emerald' },
  { key: 'preparing_materials', label: 'Malzeme hazırlanıyor', shortLabel: 'Malzeme', color: 'purple' },
  { key: 'ready_for_production', label: 'Üretime hazır', shortLabel: 'Hazır', color: 'indigo' },
  { key: 'in_production', label: 'Üretimde', shortLabel: 'Üretim', color: 'sky' },
  { key: 'quality_check', label: 'Kalite kontrol', shortLabel: 'Kalite', color: 'orange' },
  { key: 'ready_for_shipment', label: 'Sevkiyata hazır', shortLabel: 'Sevke hazır', color: 'teal' },
  { key: 'shipped', label: 'Sevk edildi', shortLabel: 'Sevk', color: 'cyan' },
  { key: 'completed', label: 'Tamamlandı', shortLabel: 'Tamam', color: 'green' },
];

// Legacy status mapping
export const LEGACY_STATUS_MAP: Record<string, string> = {
  pending: 'new',
  in_production: 'in_production',
  delivered: 'completed',
  ready: 'ready_for_shipment',
};

const BADGE_CLASSES: Record<string, string> = {
  blue: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  purple: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  indigo: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  sky: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
  orange: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  teal: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300',
  cyan: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
};

// Color classes
const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500', ring: 'ring-blue-500/20' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-500', ring: 'ring-amber-500/20' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-500', ring: 'ring-emerald-500/20' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-500', ring: 'ring-purple-500/20' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-500', ring: 'ring-indigo-500/20' },
  sky: { bg: 'bg-sky-500', text: 'text-sky-600', border: 'border-sky-500', ring: 'ring-sky-500/20' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-500', ring: 'ring-orange-500/20' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-500', ring: 'ring-teal-500/20' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-500', ring: 'ring-cyan-500/20' },
  green: { bg: 'bg-green-500', text: 'text-green-600', border: 'border-green-500', ring: 'ring-green-500/20' },
};

// ============================================
// Status Badge (standalone reusable)
// ============================================

export function StatusBadge({ status, steps }: { status: string; steps?: StatusStep[] }) {
  const allSteps = steps || ORDER_STATUS_STEPS;
  const normalizedStatus = LEGACY_STATUS_MAP[status] || status;
  const step = allSteps.find((s) => s.key === normalizedStatus);

  if (!step) {
    return (
      <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
        {{ cancelled: 'İptal edildi', on_hold: 'Beklemede' }[status] || status}
      </span>
    );
  }

  const colors = COLOR_CLASSES[step.color || 'blue'] || COLOR_CLASSES.blue;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-medium',
        BADGE_CLASSES[step.color || 'blue'] || BADGE_CLASSES.blue
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', colors.bg)} />
      {step.label}
    </span>
  );
}

// ============================================
// StatusStepper Component
// ============================================

export function StatusStepper({
  steps,
  currentStatus,
  onTransition,
  isTransitioning = false,
  allowedTransitions,
  className,
  compact = false,
}: StatusStepperProps) {
  const normalizedCurrent = LEGACY_STATUS_MAP[currentStatus] || currentStatus;
  const currentIndex = steps.findIndex((s) => s.key === normalizedCurrent);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1 overflow-x-auto', className)}>
        {steps.map((step, idx) => {
          const isPast = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;
          const colors = COLOR_CLASSES[step.color || 'blue'];

          return (
            <div key={step.key} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all',
                  isCurrent
                    ? cn('text-white shadow-md', colors.bg)
                    : isPast
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-muted-foreground line-through'
                      : 'bg-neutral-50 dark:bg-neutral-900 text-muted-foreground/60'
                )}
              >
                {isPast && <Check size={10} />}
                {step.shortLabel || step.label}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-px w-3 flex-shrink-0',
                    isPast ? 'bg-neutral-300 dark:bg-neutral-600' : 'bg-neutral-200 dark:bg-neutral-800'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // One accent for the whole track (done, current, next) so the stepper reads like the rest of the
  // workspace; colour per status stays on StatusBadge. Labels show from sm up, the phone gets one line.
  const forward = steps.findIndex((step, idx) => idx > currentIndex && (allowedTransitions ? allowedTransitions.includes(step.key) : idx === currentIndex + 1));
  const transitions = onTransition ? steps.filter((step) => (allowedTransitions ? allowedTransitions.includes(step.key) : steps.indexOf(step) === currentIndex + 1)) : [];
  return (
    <div className={cn('w-full', className)}>
      <ol className="flex items-start" aria-label="Sipariş aşamaları">
        {steps.map((step, idx) => {
          const isPast = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isTransitionable = Boolean(onTransition) && (allowedTransitions ? allowedTransitions.includes(step.key) : idx === currentIndex + 1);
          return (
            <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center" aria-current={isCurrent ? 'step' : undefined}>
              {idx < steps.length - 1 && (
                <span aria-hidden className={cn('absolute left-1/2 top-3.5 h-0.5 w-full', isPast ? 'bg-primary' : 'bg-border')} />
              )}
              <button
                type="button"
                aria-label={isTransitionable ? `${step.label} olarak işaretle` : step.label}
                onClick={() => isTransitionable && onTransition?.(step.key)}
                disabled={!isTransitionable || isTransitioning}
                className={cn(
                  'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors',
                  isPast ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent ? 'border-primary bg-background text-primary ring-4 ring-primary/15'
                    : 'border-border bg-background text-muted-foreground',
                  isTransitionable ? 'cursor-pointer hover:border-primary hover:text-primary' : 'cursor-default',
                )}
              >
                {isPast ? <Check size={13} strokeWidth={3} aria-hidden /> : idx + 1}
              </button>
              <span className={cn('mt-2 hidden max-w-[72px] text-center text-[10px] leading-tight sm:block', isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {step.shortLabel || step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {currentIndex >= 0 && (
        <p className="mt-3 text-xs text-muted-foreground sm:hidden">
          Aşama {currentIndex + 1}/{steps.length} · <span className="font-semibold text-foreground">{steps[currentIndex].label}</span>
        </p>
      )}

      {transitions.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {transitions.map((step) => (
            <button
              key={step.key}
              type="button"
              onClick={() => onTransition?.(step.key)}
              disabled={isTransitioning}
              className={cn(steps.indexOf(step) === forward ? 'rf-primary-button' : 'rf-secondary-button', 'inline-flex h-9 items-center gap-2 px-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-60')}
            >
              {isTransitioning ? <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : <Check size={15} strokeWidth={2.5} aria-hidden />}
              {step.label} olarak işaretle
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
