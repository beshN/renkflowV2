'use client';

import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { useSpotlight } from './SpotlightEffect';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'default' | 'success' | 'premium';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  children: ReactNode;
  spotlight?: boolean;
  spotlightColor?: string;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  rounded?: 'default' | 'full' | 'none';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  className,
  children,
  spotlight,
  spotlightColor,
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  rounded = 'default',
  ...props
}, ref) => {
  const { position, opacity, handleMouseMove, handleMouseEnter, handleMouseLeave } = useSpotlight();

  const baseStyles = cn(
    'group relative inline-flex items-center justify-center gap-2 font-semibold',
    'transition-all duration-300 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2',
    'focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'active:scale-[0.97] min-touch select-none'
  );

  const variants = {
    primary: cn(
      'bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white',
      'shadow-[0_8px_30px_-8px_rgba(14,165,233,0.5)]',
      'hover:shadow-[0_12px_40px_-8px_rgba(14,165,233,0.6)] hover:brightness-110',
      'before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100'
    ),
    default: cn(
      'bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white',
      'shadow-[0_8px_30px_-8px_rgba(14,165,233,0.5)]',
      'hover:shadow-[0_12px_40px_-8px_rgba(14,165,233,0.6)] hover:brightness-110'
    ),
    secondary: cn(
      'bg-slate-900 text-white dark:bg-white dark:text-slate-900',
      'shadow-sm hover:shadow-lg',
      'hover:bg-slate-800 dark:hover:bg-slate-100',
      'border border-transparent hover:border-slate-700 dark:hover:border-slate-300'
    ),
    outline: cn(
      'border-2 border-slate-200 dark:border-slate-700',
      'bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm',
      'text-slate-700 dark:text-slate-200',
      'hover:border-sky-500 hover:text-sky-600 dark:hover:border-sky-400 dark:hover:text-sky-400',
      'hover:shadow-[0_0_20px_-5px_rgba(14,165,233,0.3)]'
    ),
    ghost: cn(
      'bg-transparent text-slate-600 dark:text-slate-300',
      'hover:text-slate-900 dark:hover:text-white',
      'hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
    ),
    danger: cn(
      'bg-gradient-to-r from-red-500 to-rose-600 text-white',
      'shadow-[0_8px_25px_-8px_rgba(239,68,68,0.5)]',
      'hover:shadow-[0_12px_35px_-8px_rgba(239,68,68,0.6)] hover:brightness-110'
    ),
    success: cn(
      'bg-gradient-to-r from-emerald-500 to-teal-600 text-white',
      'shadow-[0_8px_25px_-8px_rgba(16,185,129,0.5)]',
      'hover:shadow-[0_12px_35px_-8px_rgba(16,185,129,0.6)] hover:brightness-110'
    ),
    premium: cn(
      'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white',
      'shadow-[0_8px_30px_-8px_rgba(251,146,60,0.5)]',
      'hover:shadow-[0_12px_40px_-8px_rgba(251,146,60,0.6)] hover:brightness-110',
      'before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)]',
      'before:bg-[length:250%_250%] before:animate-shimmer'
    ),
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3.5 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
    icon: 'h-10 w-10 p-0',
  };

  const roundedStyles = {
    default: 'rounded-xl',
    full: 'rounded-full',
    none: 'rounded-none',
  };

  return (
    <button
      ref={ref}
      className={cn(
        baseStyles, 
        variants[variant], 
        sizes[size],
        roundedStyles[rounded],
        spotlight && "overflow-hidden",
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
      aria-busy={isLoading || props['aria-busy']}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {spotlight && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-10"
          style={{
            opacity,
            background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor || 'rgba(255, 255, 255, 0.2)'}, transparent 40%)`,
          }}
        />
      )}
      <span className={cn(
        'relative z-20 inline-flex items-center gap-2 transition-transform duration-200',
        isLoading ? 'opacity-0' : 'opacity-100'
      )}>
        {leftIcon && <span className="transition-transform group-hover:-translate-x-0.5">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="transition-transform group-hover:translate-x-0.5">{rightIcon}</span>}
      </span>
      {isLoading && (
        <span className="absolute inset-0 z-20 flex items-center justify-center gap-2 text-current">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {loadingText && <span className="text-sm font-medium">{loadingText}</span>}
        </span>
      )}
    </button>
  );
});

Button.displayName = 'Button';
