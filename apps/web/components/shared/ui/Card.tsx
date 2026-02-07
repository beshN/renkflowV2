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
      'bg-white dark:bg-neutral-900',
      'border border-neutral-200 dark:border-neutral-800',
      'shadow-sm'
    ),
    elevated: cn(
      'bg-white dark:bg-neutral-900',
      'shadow-md',
      'border border-neutral-100 dark:border-neutral-800'
    ),
    outlined: cn(
      'bg-transparent',
      'border border-neutral-200 dark:border-neutral-700'
    ),
    glass: cn(
      'bg-white/90 dark:bg-neutral-900/90',
      'backdrop-blur-sm',
      'border border-neutral-200/50 dark:border-neutral-700/50',
      'shadow-sm'
    ),
    gradient: cn(
      'bg-gradient-to-br from-neutral-50 to-neutral-100',
      'dark:from-neutral-900 dark:to-neutral-800',
      'border border-neutral-200 dark:border-neutral-700',
      'shadow-sm'
    ),
  };

  const hoverEffects = {
    lift: 'hover:-translate-y-1 hover:shadow-lg transition-transform',
    glow: 'hover:border-sky-500 dark:hover:border-sky-400 transition-colors',
    border: 'hover:border-sky-500 dark:hover:border-sky-400 transition-colors',
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
            background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor || 'rgba(14,165,233,0.08)'}, transparent 40%)`,
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
