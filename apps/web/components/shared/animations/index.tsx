// Animation Components Index
// Apple-quality micro-interactions and animations

'use client';

import { Suspense, lazy, ReactNode } from 'react';

// Lazy load heavy animation components to reduce initial bundle size
export const LazyPageTransition = lazy(() => import('./PageTransition').then(m => ({ default: m.PageTransition })));
export const LazyParallaxSection = lazy(() => import('./ParallaxSection').then(m => ({ default: m.ParallaxSection })));
export const LazyMagneticButton = lazy(() => import('./MagneticButton').then(m => ({ default: m.MagneticButton })));

interface LazyAnimationProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function LazyAnimationWrapper({ children, fallback = null }: LazyAnimationProps) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}

// Re-export optimized components
export {
  OptimizedMotion,
  StaggerContainer,
  StaggerItem,
  FadeInSection,
  ScaleHover,
  AnimatedCounter,
} from './OptimizedMotion';

// Re-export existing components
export { HoverLift } from './HoverLift';
export { SmoothReveal, StaggerItem as SmoothRevealStaggerItem } from './SmoothReveal';
export { PageTransition, LayoutTransition, FadeIn } from './PageTransition';
export { ParallaxSection, ParallaxLayer } from './ParallaxSection';
export { MagneticButton } from './MagneticButton';

// Animation Constants - Apple Design Reference
export const EASINGS = {
  easeOutExpo: [0.19, 1, 0.22, 1] as const,
  easeSpring: [0.34, 1.56, 0.64, 1] as const,
  easeSmooth: [0.4, 0, 0.2, 1] as const,
  easeBounce: [0.68, -0.55, 0.265, 1.55] as const,
};

export const DURATIONS = {
  micro: 0.15,
  standard: 0.3,
  emphasis: 0.5,
  page: 0.4,
};

export const SPRING_CONFIGS = {
  snappy: { stiffness: 500, damping: 30, mass: 1 },
  smooth: { stiffness: 300, damping: 30, mass: 1 },
  bouncy: { stiffness: 400, damping: 25, mass: 1 },
  magnetic: { stiffness: 150, damping: 15, mass: 0.1 },
  parallax: { stiffness: 100, damping: 30, restDelta: 0.001 },
};

export const STAGGER = {
  fast: 0.03,
  default: 0.05,
  slow: 0.1,
};
