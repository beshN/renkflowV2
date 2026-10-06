'use client';

import React from 'react';
import { CutLoader } from '@/components/brand/CutLoader';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  label?: string;
  className?: string;
}

export function PageLoader({ label = 'Yükleniyor', className }: PageLoaderProps) {
  return (
    <div className={cn('fixed inset-0 z-50 bg-background/90 backdrop-blur', className)}>
      <CutLoader variant="page" label={label} className="bg-transparent" />
    </div>
  );
}
