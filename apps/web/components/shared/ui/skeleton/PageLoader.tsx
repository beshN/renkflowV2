'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  label?: string;
  className?: string;
}

export function PageLoader({ label = 'Yükleniyor...', className }: PageLoaderProps) {
  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 dark:bg-gray-950/90 backdrop-blur', className)}>
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-emerald-400 animate-logo-pulse" />
        <div className="absolute inset-1 rounded-2xl bg-white dark:bg-gray-950" />
        <div className="absolute inset-3 rounded-xl bg-gradient-to-br from-sky-500 via-blue-500 to-emerald-400" />
      </div>
      <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300" aria-live="polite">
        {label}
      </p>
    </div>
  );
}
