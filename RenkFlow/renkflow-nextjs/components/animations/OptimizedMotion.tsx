'use client';

import { motion, useReducedMotion, Variants, Transition } from 'framer-motion';
import { ReactNode, useMemo } from 'react';

interface LazyMotionProps {
  children: ReactNode;
  className?: string;
  initial?: object;
  animate?: object;
  whileInView?: object;
  transition?: Transition;
  viewport?: object;
  variants?: Variants;
  once?: boolean;
}

/**
 * Optimized Motion Wrapper
 * - Respects reduced motion preferences
 * - Memoized variants for performance
 * - Lazy viewport triggering
 */
export function OptimizedMotion({
  children,
  className,
  initial = { opacity: 0, y: 20 },
  animate,
  whileInView = { opacity: 1, y: 0 },
  transition = { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  viewport = { once: true, margin: '-50px' },
  variants,
  once = true,
}: LazyMotionProps) {
  const prefersReducedMotion = useReducedMotion();

  const memoizedTransition = useMemo(() => transition, [JSON.stringify(transition)]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={initial}
      animate={animate}
      whileInView={whileInView}
      transition={memoizedTransition}
      viewport={{ ...viewport, once }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger Container for list animations
 * Optimized for large lists with contain property
 */
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  delayStart?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.05,
  delayStart = 0,
}: StaggerContainerProps) {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants: Variants = useMemo(
    () => ({
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          delayChildren: delayStart,
          staggerChildren: staggerDelay,
        },
      },
    }),
    [staggerDelay, delayStart]
  );

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      style={{ contain: 'layout style' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger Item to be used within StaggerContainer
 */
interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale';
}

export function StaggerItem({ children, className, direction = 'up' }: StaggerItemProps) {
  const prefersReducedMotion = useReducedMotion();

  const getInitial = () => {
    switch (direction) {
      case 'up':
        return { opacity: 0, y: 20 };
      case 'down':
        return { opacity: 0, y: -20 };
      case 'left':
        return { opacity: 0, x: -20 };
      case 'right':
        return { opacity: 0, x: 20 };
      case 'scale':
        return { opacity: 0, scale: 0.9 };
      default:
        return { opacity: 0, y: 20 };
    }
  };

  const itemVariants: Variants = useMemo(
    () => ({
      hidden: getInitial(),
      visible: {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
      },
    }),
    [direction]
  );

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} variants={itemVariants} style={{ willChange: 'transform, opacity' }}>
      {children}
    </motion.div>
  );
}

/**
 * Fade In Section with optimized viewport detection
 */
interface FadeInSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
}

export function FadeInSection({
  children,
  className,
  delay = 0,
  direction = 'up',
  distance = 30,
}: FadeInSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  const getInitialPosition = () => {
    switch (direction) {
      case 'up':
        return { y: distance };
      case 'down':
        return { y: -distance };
      case 'left':
        return { x: distance };
      case 'right':
        return { x: -distance };
      case 'none':
        return {};
      default:
        return { y: distance };
    }
  };

  if (prefersReducedMotion) {
    return <section className={className}>{children}</section>;
  }

  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, ...getInitialPosition() }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.section>
  );
}

/**
 * Scale On Hover with GPU acceleration
 */
interface ScaleHoverProps {
  children: ReactNode;
  className?: string;
  scale?: number;
}

export function ScaleHover({ children, className, scale = 1.02 }: ScaleHoverProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      style={{ willChange: 'transform' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated Counter with RAF optimization
 */
interface AnimatedCounterProps {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({ value, className, duration = 2 }: AnimatedCounterProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <span className={className}>{value}</span>;
  }

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration, ease: 'easeOut' }}
      >
        {value}
      </motion.span>
    </motion.span>
  );
}
