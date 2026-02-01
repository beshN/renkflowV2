'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [pulling, setPulling] = React.useState(false);
  const [offset, setOffset] = React.useState(0);
  const startY = React.useRef<number | null>(null);

  const handleTouchStart: React.TouchEventHandler = (event) => {
    if (window.scrollY > 0) return;
    const touch = event.touches[0];
    if (!touch) return;
    startY.current = touch.clientY;
  };

  const handleTouchMove: React.TouchEventHandler = (event) => {
    if (startY.current === null) return;
    const touch = event.touches[0];
    if (!touch) return;
    const delta = Math.max(0, touch.clientY - startY.current);
    if (delta > 0) {
      setPulling(true);
      setOffset(Math.min(delta, 120));
    }
  };

  const handleTouchEnd: React.TouchEventHandler = async () => {
    if (offset > 80) {
      await onRefresh();
    }
    setPulling(false);
    setOffset(0);
    startY.current = null;
  };

  return (
    <div
      className={cn('relative', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center"
        style={{ height: offset }}
        aria-hidden="true"
      >
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
          <span className={cn('material-symbols-outlined transition-transform', pulling ? 'rotate-180' : '')}>
            arrow_downward
          </span>
          Yenilemek için bırak
        </div>
      </div>
      <div style={{ transform: `translateY(${offset}px)` }} className="transition-transform">
        {children}
      </div>
    </div>
  );
}
