'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for exit animation
    }, duration);

    // Progress bar animation
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 10);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [duration, onClose]);

  const typeStyles = {
    success: 'bg-emerald-50/90 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200',
    error: 'bg-red-50/90 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200',
    info: 'bg-sky-50/90 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-200',
    warning: 'bg-amber-50/90 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200',
  };

  const iconMap = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
    warning: TriangleAlert,
  } as const;
  const Icon = iconMap[type];

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 220);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden min-w-[300px] px-4 py-3 rounded-xl shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] transition-all duration-300 border backdrop-blur',
        typeStyles[type],
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">{message}</p>
        </div>
        <button 
          onClick={handleClose}
          aria-label="Bildirimi kapat"
          className="text-current/70 hover:text-current transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-current/20 transition-all duration-75 ease-linear" style={{ width: `${progress}%` }} />
    </div>
  );
}
