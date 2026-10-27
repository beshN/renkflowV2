'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Puzzle } from 'lucide-react';

// Fetched only when someone opens it, so an error screen stays as light as before.
const PipePuzzle = dynamic(() => import('./PipePuzzle'), {
  ssr: false,
  loading: () => <div className="mx-auto h-[220px] max-w-[260px] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />,
});

/** A quiet, optional pastime under an error message: a pipe puzzle behind one small link. */
export function WhileYouWait({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      {open ? <PipePuzzle /> : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded text-[12.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Puzzle size={13} aria-hidden /> Beklerken: hattı birleştirin
        </button>
      )}
    </div>
  );
}
