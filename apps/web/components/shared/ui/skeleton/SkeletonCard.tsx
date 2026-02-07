'use client';

import React from 'react';
import { Skeleton } from './Skeleton';
import { SkeletonText } from './SkeletonText';
import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  className?: string;
  showImage?: boolean;
}

export function SkeletonCard({ className, showImage = true }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-2xl border border-gray-200/70 dark:border-gray-800 p-4 bg-white/70 dark:bg-gray-900/60', className)}>
      {showImage && <Skeleton className="h-40 w-full rounded-xl" />}
      <div className="mt-4 space-y-3">
        <Skeleton className="h-4 w-1/2" />
        <SkeletonText lines={2} widths={[90, 70]} />
      </div>
    </div>
  );
}
