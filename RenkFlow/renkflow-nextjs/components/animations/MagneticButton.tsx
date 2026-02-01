'use client';

import { useRef, useState, useCallback, ReactNode } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

/**
 * MagneticButton - Cursor-following button with spring physics
 * 
 * Button follows cursor within 30px radius using spring physics
 * Apple-like magnetic effect on hover
 */
export function MagneticButton({ 
  children, 
  className = '',
  strength = 0.3 
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useSpring(0, { stiffness: 150, damping: 15, mass: 0.1 });
  const y = useSpring(0, { stiffness: 150, damping: 15, mass: 0.1 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    
    // Limit to 30px radius
    const maxDistance = 30;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    const factor = Math.min(distance, maxDistance) / distance || 0;
    
    x.set(distanceX * factor * strength);
    y.set(distanceY * factor * strength);
  }, [strength, x, y]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  }, [x, y]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{ x, y }}
      className={`inline-block ${className}`}
    >
      <motion.div
        animate={{ scale: isHovered ? 1.02 : 1 }}
        transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export default MagneticButton;
