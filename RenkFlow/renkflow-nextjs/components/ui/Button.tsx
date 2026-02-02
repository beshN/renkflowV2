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
      'bg-slate-900 text-white',
      'hover:bg-slate-800'
    ),
    default: cn(
      'bg-slate-900 text-white',
      'hover:bg-slate-800'
    ),
    secondary: cn(
      'bg-slate-100 text-slate-900',
      'hover:bg-slate-200',
      'border border-slate-200'
    ),
    outline: cn(
      'bg-white text-slate-700',
      'border-2 border-slate-200',
      'hover:border-slate-300 hover:bg-slate-50'
    ),
    ghost: cn(
      'bg-transparent text-slate-600',
      'hover:text-slate-900 hover:bg-slate-100'
    ),
    danger: cn(
      'bg-red-600 text-white',
      'hover:bg-red-700'
    ),
    success: cn(
      'bg-emerald-600 text-white',
      'hover:bg-emerald-700'
    ),
    premium: cn(
      'bg-amber-500 text-white',
      'hover:bg-amber-600'
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
