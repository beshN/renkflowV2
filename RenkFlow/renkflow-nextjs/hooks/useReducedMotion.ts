'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to detect user's reduced motion preference
 * Returns true if user prefers reduced motion (for accessibility & performance)
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Returns animation variants based on reduced motion preference
 */
export function useMotionSafe() {
  const prefersReducedMotion = useReducedMotion();

  return {
    prefersReducedMotion,
    // Safe animation that respects user preference
    animate: prefersReducedMotion ? {} : undefined,
    // Transition with reduced motion support
    transition: prefersReducedMotion 
      ? { duration: 0 } 
      : { duration: 0.3, ease: 'easeOut' },
    // Fade only animation for reduced motion
    fadeVariants: {
      hidden: { opacity: 0 },
      visible: { 
        opacity: 1,
        transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.5 }
      }
    }
  };
}
