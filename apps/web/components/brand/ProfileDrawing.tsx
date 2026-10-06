'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

const EASE = [0.2, 0.8, 0.2, 1] as const;

const SHELLS = [
  // Outer aluminium shell with its chamber.
  'M30 30 H112 V62 H104 V158 H112 V190 H30 Z',
  'M44 44 H92 V176 H44 Z',
  // Inner shell with two chambers.
  'M158 30 H250 V190 H158 V158 H166 V62 H158 Z',
  'M178 44 H236 V104 H178 Z',
  'M178 116 H236 V176 H178 Z',
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
 * Schematic cross-section of a thermally broken aluminium profile, drawn stroke by
 * stroke like a technical drawing. Brand motif for auth and landing surfaces.
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
      aria-label="Isı yalıtımlı alüminyum profil kesiti"
    >
      <defs>
        <pattern id={hatchId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1" opacity="0.55" />
        </pattern>
      </defs>

      <g stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        {SHELLS.map((d, index) => <motion.path key={d} d={d} variants={line(index)} />)}
      </g>

      {/* Polyamide thermal break bars */}
      <motion.g variants={fade(1.1)} stroke="currentColor" strokeWidth="1.2">
        <rect x="112" y="62" width="46" height="12" fill={`url(#${hatchId})`} />
        <rect x="112" y="146" width="46" height="12" fill={`url(#${hatchId})`} />
      </motion.g>

      {/* EPDM gaskets */}
      <motion.g variants={fade(1.3)} className="text-[hsl(var(--primary))]" stroke="currentColor" strokeWidth="1.4">
        <circle cx="250" cy="48" r="6" />
        <circle cx="30" cy="172" r="6" />
      </motion.g>

      {/* Dimension lines */}
      <g stroke="currentColor" strokeWidth="0.8" opacity="0.65">
        <motion.path d="M30 214 H250 M30 208 V220 M250 208 V220" variants={line(5, 0.7)} />
        <motion.path d="M276 30 V190 M270 30 H282 M270 190 H282" variants={line(6, 0.7)} />
        <motion.path d="M135 68 V14 H190" variants={line(7, 0.6)} />
        <motion.path d="M30 172 H6 V236 H40" variants={line(8, 0.6)} />
      </g>

      <g fill="currentColor" className="font-mono" fontSize="9" letterSpacing="0.06em">
        <motion.text variants={fade(1.7)} x="140" y="230" textAnchor="middle">70.0 mm</motion.text>
        <motion.text variants={fade(1.8)} x="290" y="113" transform="rotate(90 290 113)" textAnchor="middle">56.0</motion.text>
        <motion.text variants={fade(1.9)} x="194" y="17">ISI BARİYERİ · PA66</motion.text>
        <motion.text variants={fade(2)} x="44" y="239">EPDM CONTA</motion.text>
      </g>
    </motion.svg>
  );
}
