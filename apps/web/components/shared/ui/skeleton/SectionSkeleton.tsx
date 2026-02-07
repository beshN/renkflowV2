'use client';

import React from 'react';
import { Skeleton } from './Skeleton';
import { SkeletonText } from './SkeletonText';
import { cn } from '@/lib/utils';

interface SectionSkeletonProps {
  className?: string;
  rows?: number;
}

export function SectionSkeleton({ className, rows = 5 }: SectionSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)} aria-hidden="true">
      <Skeleton className="h-6 w-1/3" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1">
            <SkeletonText lines={2} widths={[90, 65]} />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
