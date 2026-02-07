'use client';

import { ReactNode, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface HoverLiftProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
  glare?: boolean;
  scale?: number;
}

/**
 * HoverLift - 3D tilt effect with optional glare
 * 
 * Card tilts based on cursor position (rotateX/Y)
 * Optional glare effect follows cursor
 * Apple-like depth interaction
 */
export function HoverLift({
  children,
  className = '',
  intensity = 15,
  glare = false,
  scale = 1.02,
}: HoverLiftProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(y, [0, 1], [intensity, -intensity]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(x, [0, 1], [-intensity, intensity]), {
    stiffness: 300,
    damping: 30,
  });

  const glareX = useTransform(x, [0, 1], ['0%', '100%']);
  const glareY = useTransform(y, [0, 1], ['0%', '100%']);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const xPos = (e.clientX - rect.left) / rect.width;
    const yPos = (e.clientY - rect.top) / rect.height;

    x.set(xPos);
    y.set(yPos);
  }, [x, y]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    x.set(0.5);
    y.set(0.5);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      animate={{
        scale: isHovered ? scale : 1,
        z: isHovered ? 20 : 0,
      }}
      transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
      className={`relative ${className}`}
    >
      {children}
      {glare && (
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-0"
          style={{
            background: `radial-gradient(circle at ${glareX.get()} ${glareY.get()}, rgba(255,255,255,0.3) 0%, transparent 60%)`,
            opacity: isHovered ? 0.3 : 0,
          }}
          animate={{ opacity: isHovered ? 0.3 : 0 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.div>
  );
}

export default HoverLift;
