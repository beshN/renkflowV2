'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Bir hata oluştu',
  description = 'Lütfen tekrar deneyin.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-200/60 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/30 p-6 text-center', className)}
      role="alert"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
        <span className="material-symbols-outlined">error</span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">{title}</h3>
        <p className="mt-1 text-sm text-red-600/80 dark:text-red-400/80">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="min-touch">
          Tekrar Dene
        </Button>
      )}
    </div>
  );
}
