'use client';

import React from 'react';
import { useSwipe } from '@/hooks/useSwipe';
import { cn } from '@/lib/utils';

interface SwipeAction {
  label: string;
  onClick: () => void;
  colorClass?: string;
}

interface SwipeableItemProps {
  children: React.ReactNode;
  actions: SwipeAction[];
  className?: string;
}

export function SwipeableItem({ children, actions, className }: SwipeableItemProps) {
  const [open, setOpen] = React.useState(false);

  const swipe = useSwipe({
    onSwipeLeft: () => setOpen(true),
    onSwipeRight: () => setOpen(false),
  });

  return (
    <div className={cn('relative overflow-hidden', className)} {...swipe}>
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center gap-2 px-3 transition-transform',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={cn(
              'min-touch rounded-full px-3 py-2 text-xs font-semibold text-white',
              action.colorClass || 'bg-red-500'
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div
        className={cn(
          'transition-transform',
          open ? '-translate-x-24' : 'translate-x-0'
        )}
      >
        {children}
      </div>
    </div>
  );
}
