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
  { key: 'pending_approval', label: 'Onay Bekliyor', shortLabel: 'Onay', color: 'amber' },
  { key: 'approved', label: 'Onaylandı', shortLabel: 'Onaylı', color: 'emerald' },
  { key: 'preparing_materials', label: 'Malzeme Hazırlanıyor', shortLabel: 'Malzeme', color: 'purple' },
  { key: 'ready_for_production', label: 'Üretime Hazır', shortLabel: 'Hazır', color: 'indigo' },
  { key: 'in_production', label: 'Üretimde', shortLabel: 'Üretim', color: 'sky' },
  { key: 'quality_check', label: 'Kalite Kontrol', shortLabel: 'KK', color: 'orange' },
  { key: 'ready_for_shipment', label: 'Sevkiyata Hazır', shortLabel: 'Sevkiyat', color: 'teal' },
  { key: 'shipped', label: 'Sevk Edildi', shortLabel: 'Sevkiyat', color: 'cyan' },
  { key: 'completed', label: 'Tamamlandı', shortLabel: 'Tamam', color: 'green' },
];

// Legacy status mapping
export const LEGACY_STATUS_MAP: Record<string, string> = {
  pending: 'new',
  in_production: 'in_production',
  delivered: 'completed',
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
        {status}
      </span>
    );
  }

  const colors = COLOR_CLASSES[step.color || 'blue'];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        `border-${step.color}-200 dark:border-${step.color}-900/40`,
        `bg-${step.color}-50 dark:bg-${step.color}-900/20`,
        `text-${step.color}-700 dark:text-${step.color}-400`
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

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-start">
        {steps.map((step, idx) => {
          const isPast = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const isFuture = idx > currentIndex;
          const colors = COLOR_CLASSES[step.color || 'blue'];
          const isTransitionable =
            onTransition &&
            (allowedTransitions ? allowedTransitions.includes(step.key) : idx === currentIndex + 1);

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center relative">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'absolute top-4 left-1/2 h-0.5 w-full transition-all duration-500',
                    isPast ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-neutral-200 dark:bg-neutral-800'
                  )}
                />
              )}

              {/* Step circle */}
              <button
                onClick={() => isTransitionable && onTransition?.(step.key)}
                disabled={!isTransitionable || isTransitioning}
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300',
                  isCurrent
                    ? cn('border-current text-white shadow-lg ring-4', colors.bg, colors.ring)
                    : isPast
                      ? 'border-emerald-400 bg-emerald-500 text-white'
                      : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-muted-foreground',
                  isTransitionable
                    ? 'cursor-pointer hover:scale-110 hover:shadow-md'
                    : 'cursor-default'
                )}
              >
                {isPast ? <Check size={14} strokeWidth={3} /> : idx + 1}
              </button>

              {/* Label */}
              <span
                className={cn(
                  'mt-2 text-center text-[10px] font-medium leading-tight max-w-[56px]',
                  isCurrent
                    ? colors.text
                    : isPast
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground/60'
                )}
              >
                {step.shortLabel || step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Transition buttons */}
      {onTransition && (
        <div className="mt-6 flex flex-wrap gap-2">
          {steps
            .filter((step) =>
              allowedTransitions
                ? allowedTransitions.includes(step.key)
                : steps.indexOf(step) === currentIndex + 1
            )
            .map((step) => {
              const colors = COLOR_CLASSES[step.color || 'blue'];
              return (
                <button
                  key={step.key}
                  onClick={() => onTransition(step.key)}
                  disabled={isTransitioning}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed',
                    colors.bg,
                    `shadow-${step.color}-500/25 hover:opacity-90`
                  )}
                >
                  {isTransitioning ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Check size={16} strokeWidth={2.5} />
                  )}
                  {step.label} olarak işaretle
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
