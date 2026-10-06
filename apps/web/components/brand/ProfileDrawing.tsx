'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

const EASE = [0.2, 0.8, 0.2, 1] as const;

// 100×150 pergola carrier: open gutter channel on top, two chambers below.
const SHELLS = [
  'M106 30 H120 V64 H199 V30 H213 V190 H106 Z',
  'M120 78 H199 V176 H120 Z',
  'M120 127 H199',
];

type ProfileDrawingProps = {
  className?: string;
  /** Delay before the drawing starts, in seconds. */
  delay?: number;
  /** Draw when scrolled into view instead of on mount. */
  inView?: boolean;
  /** Render fully drawn with no animation (used inside the magnifier). */
  instant?: boolean;
};

/**
 * Schematic cross-section of a pergola carrier profile with its gutter channel, drawn
 * stroke by stroke like a technical drawing. Brand motif for auth and landing surfaces.
 */
export function ProfileDrawing({ className, delay = 0.2, inView = false, instant = false }: ProfileDrawingProps) {
  const reduce = useReducedMotion();
  const hatchId = `rf-hatch-${useId().replace(/:/g, '')}`;
  const trigger = inView ? { whileInView: 'drawn', viewport: { once: true, margin: '-10%' } } : { animate: 'drawn' };
  const line = (index: number, duration = 1.1) => ({
    hidden: { pathLength: 0, opacity: 0 },
    drawn: { pathLength: 1, opacity: 1, transition: { pathLength: { duration, delay: delay + index * 0.18, ease: EASE }, opacity: { duration: 0.01, delay: delay + index * 0.18 } } },
  });
  const fade = (at: number) => ({ hidden: { opacity: 0, y: 3 }, drawn: { opacity: 1, y: 0, transition: { duration: 0.5, delay: delay + at } } });

  return (
    <motion.svg
      viewBox="0 0 320 250"
      fill="none"
      className={cn('h-auto w-full overflow-visible', className)}
      initial={reduce || instant ? 'drawn' : 'hidden'}
      {...trigger}
      role="img"
      aria-label="Pergola taşıyıcı profil kesiti"
    >
      <defs>
        <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1" opacity="0.55" />
        </pattern>
      </defs>

      <g stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        {SHELLS.map((d, index) => <motion.path key={d} d={d} variants={line(index)} />)}
      </g>

      {/* Water in the gutter channel */}
      <motion.g variants={fade(1.1)} stroke="currentColor" strokeWidth="1.2">
        <rect x="120" y="50" width="79" height="14" fill={`url(#${hatchId})`} />
      </motion.g>

      {/* Screw ports */}
      <motion.g variants={fade(1.3)} className="text-[hsl(var(--primary))]" stroke="currentColor" strokeWidth="1.4">
        <circle cx="132" cy="90" r="5" />
        <circle cx="187" cy="90" r="5" />
        <circle cx="132" cy="164" r="5" />
        <circle cx="187" cy="164" r="5" />
      </motion.g>

      {/* Dimension lines */}
      <g stroke="currentColor" strokeWidth="0.8" opacity="0.65">
        <motion.path d="M106 214 H213 M106 208 V220 M213 208 V220" variants={line(4, 0.7)} />
        <motion.path d="M240 30 V190 M234 30 H246 M234 190 H246" variants={line(5, 0.7)} />
        <motion.path d="M160 57 V12 H222" variants={line(6, 0.6)} />
        <motion.path d="M127 164 H62 V196" variants={line(7, 0.6)} />
      </g>

      <g fill="currentColor" className="font-mono" fontSize="9" letterSpacing="0.06em">
        <motion.text variants={fade(1.7)} x="160" y="230" textAnchor="middle">100.0 mm</motion.text>
        <g transform="rotate(90 256 110)"><motion.text variants={fade(1.8)} x="256" y="110" textAnchor="middle">150.0</motion.text></g>
        <motion.text variants={fade(1.9)} x="226" y="15">DERE KANALI</motion.text>
        <motion.text variants={fade(2)} x="62" y="208" textAnchor="middle">VİDA YUVASI</motion.text>
      </g>
    </motion.svg>
  );
}
