'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Closed tasks keep long forms out of the way. Once opened, input values survive closing. */
export function TaskDisclosure({ title, children, id, group, open, onToggle }: {
  title: string; children: ReactNode; id?: string; group?: string; open?: boolean; onToggle?: (open: boolean) => void;
}) {
  const [visited, setVisited] = useState(Boolean(open));
  return <details id={id} name={group} open={open} className="group/task rounded-lg border border-border bg-card"
    onToggle={event => { const expanded = event.currentTarget.open; if (expanded) setVisited(true); onToggle?.(expanded); }}>
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
      {title}<ChevronDown size={16} aria-hidden className="shrink-0 text-muted-foreground transition-transform group-open/task:rotate-180 motion-reduce:transition-none" />
    </summary>
    {visited && <div className="border-t border-border p-4">{children}</div>}
  </details>;
}
