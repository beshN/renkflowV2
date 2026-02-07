'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StaggeredRevealProps {
  children: React.ReactNode[];
  className?: string;
  delayStep?: number;
}

export function StaggeredReveal({ children, className, delayStep = 90 }: StaggeredRevealProps) {
  return (
    <div className={cn('staggered-reveal', className)}>
      {React.Children.map(children, (child, index) => (
        <div
          className="staggered-item"
          style={{ animationDelay: `${index * delayStep}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
