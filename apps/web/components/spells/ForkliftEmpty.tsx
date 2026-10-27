'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// The game is only fetched when someone actually taps the forklift.
const PalletGame = dynamic(() => import('./PalletGame'), { ssr: false });

/**
 * Empty-list drawing: a corner of the workshop (rack with profile bars, a pallet stack)
 * and a forklift. The forklift is a quiet button that opens a pallet stacking game; the
 * list's own title and actions stay what you are meant to look at.
 */
export function ForkliftEmpty() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative">
      <svg aria-hidden width="176" height="72" viewBox="0 0 176 72" className="block text-muted-foreground/45">
        <line x1="4" y1="66.5" x2="172" y2="66.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Rack with profile bars */}
        <g fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="10" y1="12" x2="10" y2="66" />
          <line x1="54" y1="12" x2="54" y2="66" />
          <line x1="8" y1="30" x2="56" y2="30" />
          <line x1="8" y1="48" x2="56" y2="48" />
        </g>
        <g fill="currentColor" opacity="0.7">
          <rect x="13" y="25" width="38" height="2.5" rx="0.6" />
          <rect x="15" y="21.5" width="33" height="2.5" rx="0.6" />
          <rect x="13" y="43" width="26" height="2.5" rx="0.6" />
          <rect x="13" y="39.5" width="36" height="2.5" rx="0.6" />
          <rect x="13" y="61" width="30" height="2.5" rx="0.6" />
        </g>
        {/* Pallet stack */}
        <g fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="64" y="58" width="30" height="3" rx="0.5" />
          <path d="M65 61v5M78.5 61v5M92 61v5" />
          <rect x="64" y="47" width="30" height="3" rx="0.5" />
          <path d="M65 50v7M78.5 50v7M92 50v7" />
          <rect x="68" y="35" width="22" height="12" rx="1" />
          <path d="M68 40h22" strokeDasharray="2 2" />
        </g>
      </svg>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Forklift: palet istifleme oyununu aç"
        title="Forklift"
        className="group absolute right-0 top-0 h-[72px] w-[78px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      >
        <svg aria-hidden width="78" height="72" viewBox="98 0 78 72" className="block">
          {/* Mast and forks (lift a little on hover) */}
          <g className="transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
            <g className="text-muted-foreground/55" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="101" y="49" width="17" height="2.5" rx="0.5" />
              <path d="M102 51.5v3.5M109.5 51.5v3.5M117 51.5v3.5" />
              <rect x="103" y="38" width="13" height="11" rx="1" />
            </g>
            <path d="M100 56.5h20" stroke="hsl(var(--foreground) / 0.55)" strokeWidth="1.6" strokeLinecap="round" />
          </g>
          <rect x="120" y="14" width="3.5" height="50" rx="1" fill="hsl(var(--foreground) / 0.5)" />
          {/* Cab guard */}
          <path d="M131 44V20h22l3 24" fill="none" stroke="hsl(var(--foreground) / 0.5)" strokeWidth="1.6" strokeLinejoin="round" />
          {/* Body and counterweight */}
          <path d="M124 44h38a4 4 0 0 1 4 4v10a3 3 0 0 1-3 3h-39z" fill="hsl(var(--primary))" opacity="0.85" />
          <rect x="138" y="36" width="9" height="8" rx="1.5" fill="hsl(var(--primary))" opacity="0.6" />
          <circle cx="133" cy="62" r="5" fill="hsl(var(--card))" stroke="hsl(var(--foreground) / 0.6)" strokeWidth="2" />
          <circle cx="157" cy="62" r="5" fill="hsl(var(--card))" stroke="hsl(var(--foreground) / 0.6)" strokeWidth="2" />
          <circle cx="160" cy="27" r="1.6" fill="hsl(var(--primary))" className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </svg>
      </button>
      {open && <PalletGame onClose={() => { setOpen(false); requestAnimationFrame(() => button.current?.focus()); }} />}
    </div>
  );
}
