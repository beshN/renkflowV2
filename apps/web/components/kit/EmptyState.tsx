import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Nothing here yet: one drawing (a profile bar with a cut mark, the firm's own motif) or an icon,
 * a short title and at most one button. No sentences.
 */
export function EmptyState({ title, icon: Icon, action, className }: {
  title: string;
  icon?: LucideIcon;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center', className)}>
      {Icon ? <Icon size={36} strokeWidth={1.5} aria-hidden className="text-muted-foreground/60" /> : (
        <svg aria-hidden width="120" height="40" viewBox="0 0 120 40" className="text-muted-foreground/50">
          <rect x="4" y="14" width="112" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="44" y1="8" x2="44" y2="32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="82" y1="8" x2="82" y2="32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      )}
      <p className="text-sm font-medium">{title}</p>
      {action && (action.href
        ? <Link href={action.href} className="rf-primary-button h-9 px-3 text-xs">{action.label}</Link>
        : <button type="button" onClick={action.onClick} className="rf-primary-button h-9 px-3 text-xs">{action.label}</button>)}
    </div>
  );
}
