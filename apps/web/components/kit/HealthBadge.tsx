import { AlertOctagon, AlertTriangle, CheckCircle2, Eye, Flag } from 'lucide-react';
import type { Health } from '@/lib/features/orders/lifecycle';
import { cn } from '@/lib/utils';

const LOOK = {
  good: { icon: CheckCircle2, cls: 'text-emerald-700 dark:text-emerald-300', label: 'Yolunda' },
  watch: { icon: Eye, cls: 'text-amber-700 dark:text-amber-300', label: 'İzle' },
  risk: { icon: AlertTriangle, cls: 'text-orange-700 dark:text-orange-300', label: 'Risk' },
  late: { icon: AlertOctagon, cls: 'text-rose-700 dark:text-rose-300', label: 'Gecikti' },
  done: { icon: Flag, cls: 'text-muted-foreground', label: 'Bitti' },
};

/** Order health at a glance: an icon shape per level plus days left, never colour alone. */
export function HealthBadge({ health, className }: { health: Health; className?: string }) {
  const l = LOOK[health.level];
  const days = health.daysLeft === null ? '' : health.daysLeft < 0 ? `${-health.daysLeft} g geç` : health.daysLeft === 0 ? 'bugün' : `${health.daysLeft} g`;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', l.cls, className)} title={`Sağlık ${health.score}/100`}>
      <l.icon size={13} aria-hidden />
      {l.label}{days && <span className="tabular-nums text-muted-foreground">· {days}</span>}
    </span>
  );
}
