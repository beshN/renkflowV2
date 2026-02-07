'use client';

import { ReactNode, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  offset?: [number, number];
}

/**
 * ParallaxSection - Scroll-based transforms with smooth easing
 * 
 * Creates Apple-like parallax effect where element moves at different speed than scroll
 * Smooth spring physics for natural feel
 */
export function ParallaxSection({
  children,
  className = '',
  speed = 0.5,
  direction = 'up',
  offset = [0, 1],
}: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset,
  });

  const getTransformValues = () => {
    const distance = 100 * speed;
    switch (direction) {
      case 'up':
        return {
          y: useTransform(scrollYProgress, [0, 1], [distance, -distance]),
          x: useTransform(scrollYProgress, [0, 1], [0, 0]),
        };
      case 'down':
        return {
          y: useTransform(scrollYProgress, [0, 1], [-distance, distance]),
          x: useTransform(scrollYProgress, [0, 1], [0, 0]),
        };
      case 'left':
        return {
          y: useTransform(scrollYProgress, [0, 1], [0, 0]),
          x: useTransform(scrollYProgress, [0, 1], [distance, -distance]),
        };
      case 'right':
        return {
          y: useTransform(scrollYProgress, [0, 1], [0, 0]),
          x: useTransform(scrollYProgress, [0, 1], [-distance, distance]),
        };
    }
  };

  const transforms = getTransformValues();

  const smoothY = useSpring(transforms.y, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const smoothX = useSpring(transforms.x, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div ref={ref} className="relative overflow-hidden">
      <motion.div
        style={{ y: smoothY, x: smoothX }}
        className={className}
      >
        {children}
      </motion.div>
    </div>
  );
}

interface ParallaxLayerProps {
  children: ReactNode;
  className?: string;
  depth?: number;
}

/**
 * ParallaxLayer - Multi-layer parallax effect
 * 
 * Higher depth = faster movement (closer to viewer)
 * Lower depth = slower movement (farther from viewer)
 */
export function ParallaxLayer({
  children,
  className = '',
  depth = 0.5,
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [`${-50 * depth}%`, `${50 * depth}%`]
  );

  const smoothY = useSpring(y, {
    stiffness: 100,
    damping: 30,
  });

  return (
    <motion.div ref={ref} style={{ y: smoothY }} className={className}>
      {children}
    </motion.div>
  );
}

export default ParallaxSection;
