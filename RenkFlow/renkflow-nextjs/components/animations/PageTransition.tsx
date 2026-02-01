'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * PageTransition - Smooth route transitions with AnimatePresence
 * 
 * Apple-like fade + slight scale on route change
 * Duration: 300ms standard with ease-out-expo
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{
          duration: 0.3,
          ease: [0.19, 1, 0.22, 1], // ease-out-expo
        }}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface LayoutTransitionProps {
  children: ReactNode;
  layoutId: string;
}

/**
 * LayoutTransition - Shared layout animations for filter/sort operations
 * 
 * Smooth position/size animations when items reorder
 */
export function LayoutTransition({ children, layoutId }: LayoutTransitionProps) {
  return (
    <motion.div
      layoutId={layoutId}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 30,
        mass: 1,
      }}
    >
      {children}
    </motion.div>
  );
}

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

/**
 * FadeIn - Simple fade animation wrapper
 * 
 * @param delay - Animation delay in seconds
 * @param duration - Animation duration in seconds
 */
export function FadeIn({ 
  children, 
  className = '', 
  delay = 0,
  duration = 0.3 
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration,
        delay,
        ease: [0.19, 1, 0.22, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
