'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Copies a value and morphs its icon into a check for a moment. */
export function CopyChip({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch { /* Clipboard may be blocked; nothing to undo. */ }
      }}
      aria-label={copied ? 'Kopyalandı' : `${label || value} kopyala`}
      title={copied ? 'Kopyalandı' : 'Kopyala'}
      className={cn('relative inline-grid h-5 w-5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100', copied && 'opacity-100', className)}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={copied ? 'ok' : 'copy'} initial={{ scale: 0.5, opacity: 0, rotate: copied ? -45 : 0 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }}>
          {copied ? <Check size={12} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={12} />}
        </motion.span>
      </AnimatePresence>
      <span role="status" className="sr-only">{copied ? 'Kopyalandı' : ''}</span>
    </button>
  );
}
