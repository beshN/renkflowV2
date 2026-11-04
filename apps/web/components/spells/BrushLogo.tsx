'use client';

import { useFunFeatures } from '@/lib/features/settings/useFunFeatures';
import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { createRapidClickCounter } from '@/lib/spells/rapid-clicks';

/**
 * Wraps the brand link: seven quick clicks paint one stroke across the page. A single
 * click navigates as usual; only the follow-up clicks of a rapid run are swallowed.
 * The painting code loads on the seventh click, not before.
 */
export function BrushLogo({ children }: { children: ReactNode }) {
  const enabled = useFunFeatures();
  const counter = useRef<ReturnType<typeof createRapidClickCounter> | null>(null);
  const active = useRef(enabled);
  active.current = enabled;
  useEffect(() => { if (!enabled) counter.current = null; }, [enabled]);
  const onClickCapture = (event: MouseEvent) => {
    if (!enabled) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    counter.current ??= createRapidClickCounter({ target: 7, windowMs: 3000, gapMs: 700 });
    const result = counter.current(event.timeStamp || performance.now());
    if (result.inSequence) event.preventDefault();
    if (result.fired) void import('./paint-stroke').then((m) => { if (active.current) m.paintStroke(); }).catch(() => { /* just a flourish */ });
  };
  return <span className="contents" onClickCapture={enabled ? onClickCapture : undefined}>{children}</span>;
}
