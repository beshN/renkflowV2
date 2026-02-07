'use client';

import React from 'react';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

interface SkeletonChartProps {
  bars?: number;
  className?: string;
}

export function SkeletonChart({ bars = 6, className }: SkeletonChartProps) {
  return (
    <div className={cn('flex items-end gap-3 h-32', className)} aria-hidden="true">
      {Array.from({ length: bars }).map((_, index) => {
        const height = 35 + (index % 4) * 12;
        return <Skeleton key={index} className="w-6 rounded-lg" style={{ height }} />;
      })}
    </div>
  );
}
