'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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
    success: 'bg-green-500 border-green-600',
    error: 'bg-red-500 border-red-600',
    info: 'bg-blue-500 border-blue-600',
    warning: 'bg-yellow-500 border-yellow-600',
  };

  const icons = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
    warning: 'warning',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden min-w-[300px] px-4 py-3 rounded-lg shadow-lg text-white transition-all duration-300 border',
        typeStyles[type],
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined mt-0.5">
          {icons[type]}
        </span>
        <div className="flex-1">
          <p className="font-medium text-sm">{message}</p>
        </div>
        <button 
          onClick={() => setIsVisible(false)} 
          className="text-white/80 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
      
      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-white/30 transition-all duration-75 ease-linear" style={{ width: `${progress}%` }} />
    </div>
  );
}
