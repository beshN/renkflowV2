'use client';

import { animate, motion, useInView, useReducedMotion, type Variants } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const EASE = [0.2, 0.8, 0.2, 1] as const;

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Vertical travel in px before the element settles. */
  y?: number;
  as?: 'div' | 'section' | 'li' | 'article' | 'header';
};

/** Fades and lifts its children slightly the first time they scroll into view. */
export function Reveal({ children, className, delay = 0, y = 12, as = 'div' }: RevealProps) {
  const reduce = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {children}
    </Component>
  );
}

const staggerParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

/** Container whose `StaggerItem` children appear one after another. */
export function Stagger({ children, className, immediate = false }: { children: ReactNode; className?: string; immediate?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial={reduce ? false : 'hidden'}
      {...(immediate ? { animate: 'show' } : { whileInView: 'show', viewport: { once: true, margin: '0px 0px -8% 0px' } })}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={staggerChild}>{children}</motion.div>;
}

/** Counts up to `value` once visible; renders the final value for reduced motion and SSR. */
export function CountUp({ value, className, format }: { value: number; className?: string; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const render = format || ((n: number) => Math.round(n).toLocaleString('tr-TR'));
  const [display, setDisplay] = useState(() => render(value));
  useEffect(() => {
    if (!inView || reduce || !Number.isFinite(value) || value === 0) { setDisplay(render(value)); return; }
    const controls = animate(0, value, { duration: 0.8, ease: EASE, onUpdate: (n) => setDisplay(render(n)) });
    return () => controls.stop();
  }, [inView, reduce, value]);
  return <span ref={ref} className={cn('tabular-nums', className)}>{display}</span>;
}
