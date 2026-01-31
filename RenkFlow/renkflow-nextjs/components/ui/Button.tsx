'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useSpotlight } from './SpotlightEffect';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: ReactNode;
  spotlight?: boolean;
  spotlightColor?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  spotlight,
  spotlightColor,
  ...props
}: ButtonProps) {
  const { position, opacity, handleMouseMove, handleMouseEnter, handleMouseLeave } = useSpotlight();

  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white shadow-[0_18px_30px_-18px_rgba(14,165,233,0.7)] hover:opacity-90',
    default:
      'bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white shadow-[0_18px_30px_-18px_rgba(14,165,233,0.7)] hover:opacity-90',
    secondary:
      'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm',
    outline:
      'border border-slate-200/80 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 hover:border-sky-300 hover:text-slate-900 dark:hover:text-white',
    ghost:
      'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70',
    danger:
      'bg-red-500 text-white hover:bg-red-600 shadow-sm hover:shadow-md',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    icon: 'h-10 w-10',
  };

  return (
    <button
      className={cn(
        baseStyles, 
        variants[variant], 
        sizes[size], 
        spotlight && "relative overflow-hidden",
        className
      )}
      onMouseMove={(e) => {
        if (spotlight) handleMouseMove(e);
        props.onMouseMove?.(e);
      }}
      onMouseEnter={(e) => {
        if (spotlight) handleMouseEnter();
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (spotlight) handleMouseLeave();
        props.onMouseLeave?.(e);
      }}
      {...props}
    >
      {spotlight && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            opacity,
            background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor || 'rgba(255, 255, 255, 0.15)'}, transparent 40%)`,
          }}
        />
      )}
      {children}
    </button>
  );
}
