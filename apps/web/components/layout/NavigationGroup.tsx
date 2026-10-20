'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Groups open automatically for the current screen, with native keyboard-accessible controls. */
export function NavigationGroup({ label, active, initiallyOpen = false, expanded = true, children }: {
  label: string; active: boolean; initiallyOpen?: boolean; expanded?: boolean; children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(initiallyOpen || active);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  return <section className="mt-4">
    {expanded ? <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
      className="sb-muted sb-hover mb-1 flex min-h-7 w-full items-center justify-between rounded-[4px] px-2.5 text-[11px] font-semibold tracking-[0.02em]">
      {label}<ChevronDown size={14} aria-hidden className={cn('transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
    </button> : <span className="sr-only">{label}</span>}
    <div id={id} hidden={expanded && !open} className="space-y-px">{children}</div>
  </section>;
}
