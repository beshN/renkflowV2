'use client';

import { ReactNode, forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useSpotlight } from './SpotlightEffect';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass' | 'gradient';
  hover?: boolean | 'lift' | 'glow' | 'border';
  spotlight?: boolean;
  spotlightColor?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ 
  children, 
  className, 
  variant = 'default',
  hover = false, 
  spotlight, 
  spotlightColor,
  padding = 'md',
  ...props 
}, ref) => {
  const { position, opacity, handleMouseMove, handleMouseEnter, handleMouseLeave } = useSpotlight();

  const variants = {
    default: cn(
      'bg-white/92 dark:bg-slate-900/85',
      'backdrop-blur-sm',
      'border border-slate-200/75 dark:border-slate-700/70',
      'shadow-[0_12px_34px_-24px_rgba(15,23,42,0.55)]'
    ),
    elevated: cn(
      'bg-white dark:bg-slate-900',
      'border border-slate-200/75 dark:border-slate-700/75',
      'shadow-[0_18px_40px_-24px_rgba(15,23,42,0.6)]'
    ),
    outlined: cn(
      'bg-transparent',
      'border border-slate-200/80 dark:border-slate-700/80'
    ),
    glass: cn(
      'bg-white/40 dark:bg-slate-900/40',
      'backdrop-blur-xl',
      'border border-white/40 dark:border-white/10',
      'shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]'
    ),
    gradient: cn(
      'bg-gradient-to-br from-white via-sky-50/30 to-indigo-50/40',
      'dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/40',
      'border border-slate-200/70 dark:border-slate-700/70',
      'shadow-[0_14px_36px_-24px_rgba(15,23,42,0.58)]'
    ),
  };

  const hoverEffects = {
    lift: 'hover:-translate-y-1 hover:shadow-[0_20px_42px_-24px_rgba(15,23,42,0.62)] transition-transform',
    glow: 'hover:border-sky-500/80 dark:hover:border-sky-400/80 transition-colors',
    border: 'hover:border-sky-500/80 dark:hover:border-sky-400/80 transition-colors',
  };

  const paddings = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const hoverClass = hover === true ? hoverEffects.lift : hover ? hoverEffects[hover] : '';

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl transition-all duration-300 ease-out',
        variants[variant],
        paddings[padding],
        hoverClass,
        spotlight && "relative overflow-hidden",
        className
      )}
      onMouseMove={spotlight ? handleMouseMove : undefined}
      onMouseEnter={spotlight ? handleMouseEnter : undefined}
      onMouseLeave={spotlight ? handleMouseLeave : undefined}
      {...props}
    >
      {spotlight && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 rounded-[inherit] z-10"
          style={{
            opacity,
            background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor || 'rgba(184,116,68,0.08)'}, transparent 40%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
});

Card.displayName = 'Card';

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ children, className, action }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="flex-1">{children}</div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function CardTitle({ children, className, as: Tag = 'h3' }: CardTitleProps) {
  return (
    <Tag className={cn(
      'text-lg font-semibold tracking-tight',
      'text-slate-900 dark:text-white',
      className
    )}>
      {children}
    </Tag>
  );
}

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-slate-500 dark:text-slate-400 mt-1', className)}>
      {children}
    </p>
  );
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
    </div>
  );
}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 mt-6 pt-4',
      'border-t border-slate-100 dark:border-slate-800',
      className
    )}>
      {children}
    </div>
  );
}
