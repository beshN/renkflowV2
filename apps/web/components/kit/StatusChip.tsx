import { AlertTriangle, CheckCircle2, CircleDashed, CircleDot, Clock3, PauseCircle, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted';
const STYLE: Record<Tone, { cls: string; icon: LucideIcon }> = {
  neutral: { cls: 'border-border text-foreground', icon: CircleDot },
  info: { cls: 'border-primary/30 text-primary', icon: Clock3 },
  success: { cls: 'border-emerald-600/30 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  warning: { cls: 'border-amber-600/35 text-amber-800 dark:text-amber-300', icon: AlertTriangle },
  danger: { cls: 'border-rose-600/35 text-rose-700 dark:text-rose-300', icon: XCircle },
  muted: { cls: 'border-border text-muted-foreground', icon: PauseCircle },
};

/** A status with an icon and a word: colour never carries the meaning alone. */
export function StatusChip({ tone = 'neutral', label, icon, className }: { tone?: Tone; label: string; icon?: LucideIcon; className?: string }) {
  const s = STYLE[tone];
  const Icon = icon ?? s.icon;
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium', s.cls, className)}>
      <Icon size={12} aria-hidden />
      {label}
    </span>
  );
}
export const PendingIcon = CircleDashed;
