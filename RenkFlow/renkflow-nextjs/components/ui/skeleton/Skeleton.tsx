'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'rounded' | 'circle';
  shimmer?: boolean;
}

export function Skeleton({
  variant = 'rounded',
  shimmer = true,
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton-base',
        shimmer && 'skeleton-shimmer',
        variant === 'rect' && 'rounded-none',
        variant === 'rounded' && 'rounded-lg',
        variant === 'circle' && 'rounded-full',
        className
      )}
      {...props}
    />
  );
}
