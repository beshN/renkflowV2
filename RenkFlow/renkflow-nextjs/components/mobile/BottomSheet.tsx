'use client';

import * as React from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onOpenChange, title, children }: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[85vh] flex-col rounded-t-3xl border border-gray-200/50 dark:border-gray-800/60 bg-white dark:bg-gray-950">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />
          {title && (
            <div className="px-6 pt-4 text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </div>
          )}
          <div className={cn('flex-1 overflow-y-auto px-6 pb-8 pt-4', title ? '' : 'pt-6')}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
