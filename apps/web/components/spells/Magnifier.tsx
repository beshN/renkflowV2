'use client';

import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type MagnifierProps = {
  children: ReactNode;
  /** Same content rendered without entrance animation, shown inside the lens. */
  lens: ReactNode;
  zoom?: number;
  size?: number;
  className?: string;
};

/** Preview.app-style loupe that follows a fine pointer over technical drawings. */
export function Magnifier({ children, lens, zoom = 2.2, size = 132, className }: MagnifierProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{ x: number; y: number; w: number } | null>(null);
  return (
    <div
      ref={ref}
      className={`relative cursor-none ${className || ''}`}
      onPointerMove={(event) => {
        if (event.pointerType !== 'mouse' || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top, w: rect.width });
      }}
      onPointerLeave={() => setPoint(null)}
    >
      {children}
      <AnimatePresence>
        {point && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute z-10 overflow-hidden rounded-full border border-white/25 bg-[#0a0a0b] shadow-[0_12px_32px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            style={{ width: size, height: size, left: point.x - size / 2, top: point.y - size / 2 }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: point.w, transform: `translate(${size / 2 - point.x * zoom}px, ${size / 2 - point.y * zoom}px) scale(${zoom})` }}
            >
              {lens}
            </div>
            <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-[hsl(var(--primary))]" />
            <span className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-[hsl(var(--primary))]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
