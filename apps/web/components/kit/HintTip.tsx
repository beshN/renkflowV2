'use client';

import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';

/** The only place for an explanation: a small (i) that opens on tap or keyboard. */
export function HintTip({ text, label = 'Açıklama' }: { text: string; label?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger aria-label={label} className="inline-grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Info size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={12} className="z-50 max-w-[260px] rounded-md border border-border bg-popover p-2.5 whitespace-pre-line text-xs font-normal leading-5 text-popover-foreground shadow-md">
          {text}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
