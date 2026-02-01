// Animation Components Index
// Apple-quality micro-interactions and animations

export { MagneticButton } from './MagneticButton';
export { SmoothReveal, StaggerItem } from './SmoothReveal';
export { HoverLift } from './HoverLift';
export { ParallaxSection, ParallaxLayer } from './ParallaxSection';
export { PageTransition, LayoutTransition, FadeIn } from './PageTransition';

// Animation Constants - Apple Design Reference
export const EASINGS = {
  // Smooth deceleration - primary Apple easing
  easeOutExpo: [0.19, 1, 0.22, 1] as const,
  // Bouncy spring effect
  easeSpring: [0.34, 1.56, 0.64, 1] as const,
  // Standard smooth
  easeSmooth: [0.4, 0, 0.2, 1] as const,
  // Bounce effect
  easeBounce: [0.68, -0.55, 0.265, 1.55] as const,
};

export const DURATIONS = {
  micro: 0.15,      // 150ms - button states, small UI changes
  standard: 0.3,    // 300ms - standard transitions
  emphasis: 0.5,    // 500ms - important animations
  page: 0.4,        // 400ms - page transitions
};

export const SPRING_CONFIGS = {
  // Snappy spring for buttons
  snappy: { stiffness: 500, damping: 30, mass: 1 },
  // Smooth spring for layouts
  smooth: { stiffness: 300, damping: 30, mass: 1 },
  // Bouncy spring for emphasis
  bouncy: { stiffness: 400, damping: 25, mass: 1 },
  // Magnetic effect for cursor following
  magnetic: { stiffness: 150, damping: 15, mass: 0.1 },
  // Parallax spring for scroll effects
  parallax: { stiffness: 100, damping: 30, restDelta: 0.001 },
};

export const STAGGER = {
  fast: 0.03,
  default: 0.05,
  slow: 0.1,
};
