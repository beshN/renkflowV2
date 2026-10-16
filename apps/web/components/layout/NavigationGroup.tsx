'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Groups open automatically for the current screen, with native keyboard-accessible controls. */
export function NavigationGroup({
  label,
  active,
  initiallyOpen = false,
  expanded = true,
  storageKey,
  children,
}: {
  label: string;
  active: boolean;
  initiallyOpen?: boolean;
  expanded?: boolean;
  storageKey?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(initiallyOpen || active);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = storageKey ? localStorage.getItem(storageKey) : null;
    } catch {
      /* Storage is optional. */
    }
    setOpen(active || (saved === null ? initiallyOpen : saved === 'true'));
  }, [storageKey]);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  return (
    <section className="mt-3">
      {expanded ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() =>
            setOpen((value) => {
              const next = !value;
              try {
                if (storageKey) localStorage.setItem(storageKey, String(next));
              } catch {
                /* Storage is optional. */
              }
              return next;
            })
          }
          className="sb-muted sb-hover mb-1 flex min-h-9 w-full items-center justify-between rounded-md px-2.5 text-xs font-medium"
        >
          {label}
          <ChevronDown
            size={14}
            aria-hidden
            className={cn(
              'transition-transform motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      ) : (
        <span className="sr-only">{label}</span>
      )}
      <div
        id={id}
        hidden={expanded && !open}
        className="rf-nav-group space-y-0.5"
      >
        {children}
      </div>
    </section>
  );
}
