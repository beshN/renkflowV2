'use client';

import React from 'react';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

interface SkeletonAvatarProps {
  size?: number;
  className?: string;
}

export function SkeletonAvatar({ size = 40, className }: SkeletonAvatarProps) {
  return (
    <Skeleton
      variant="circle"
      className={cn('skeleton-pulse', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
