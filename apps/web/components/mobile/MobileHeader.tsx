'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  title: string;
  rightSlot?: React.ReactNode;
  className?: string;
}

export function MobileHeader({ title, rightSlot, className }: MobileHeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={cn(
        'sticky top-0 z-40 flex items-center justify-between px-4 py-3 backdrop-blur-md transition-colors',
        scrolled ? 'bg-white/80 dark:bg-gray-950/80 border-b border-gray-200/70 dark:border-gray-800/70' : 'bg-transparent',
        className
      )}
    >
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      {rightSlot}
    </div>
  );
}
