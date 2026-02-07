'use client';

import React from 'react';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

interface SkeletonTextProps {
  lines?: number;
  widths?: number[];
  className?: string;
  lineClassName?: string;
}

export function SkeletonText({
  lines = 3,
  widths = [80, 60, 100],
  className,
  lineClassName,
}: SkeletonTextProps) {
  const resolved = Array.from({ length: lines }).map((_, i) => widths[i % widths.length]);

  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {resolved.map((width, index) => (
        <Skeleton
          key={`${width}-${index}`}
          className={cn('h-3', lineClassName)}
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}
