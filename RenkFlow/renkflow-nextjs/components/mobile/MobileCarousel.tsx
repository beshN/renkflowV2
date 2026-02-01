'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MobileCarouselProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileCarousel({ children, className }: MobileCarouselProps) {
  return (
    <div
      className={cn(
        'flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 touch-pan-x',
        className
      )}
    >
      {React.Children.map(children, (child, index) => (
        <div key={index} className="snap-start shrink-0">
          {child}
        </div>
      ))}
    </div>
  );
}
