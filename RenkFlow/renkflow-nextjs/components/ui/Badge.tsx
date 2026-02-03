'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getOrderStatusInfo } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 font-medium transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        primary: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
        secondary: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        danger: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
        info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
        pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
        orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
        outline: 'bg-transparent border-2 border-current',
        ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800',
        gradient: 'bg-gradient-to-r from-sky-500 to-emerald-500 text-white',
        premium: 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-sm',
        shimmer: 'relative bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-300 overflow-hidden',
      },
      size: {
        xs: 'text-[10px] px-1.5 py-0.5',
        sm: 'text-xs px-2 py-0.5',
        default: 'text-xs px-2.5 py-1',
        lg: 'text-sm px-3 py-1.5',
        xl: 'text-base px-4 py-2',
      },
      radius: {
        none: 'rounded-none',
        sm: 'rounded-md',
        default: 'rounded-full',
        lg: 'rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      radius: 'default',
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  status?: string;
  className?: string;
  dot?: boolean;
  dotColor?: string;
  icon?: ReactNode;
  removable?: boolean;
  onRemove?: () => void;
  pulse?: boolean;
}

export function Badge({ 
  children, 
  variant = 'default',
  size = 'default',
  radius = 'default',
  status, 
  className,
  dot = false,
  dotColor,
  icon,
  removable = false,
  onRemove,
  pulse = false,
}: BadgeProps) {
  // If status is provided, use status-specific styling
  if (status) {
    const statusInfo = getOrderStatusInfo(status);
    return (
      <span
        className={cn(
          badgeVariants({ size, radius }),
          'ring-1 ring-inset ring-slate-900/5 dark:ring-white/10',
          statusInfo.bgColor,
          statusInfo.color,
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-current animate-pulse"></span>
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        badgeVariants({ variant, size, radius }),
        'ring-1 ring-inset ring-slate-900/5 dark:ring-white/10',
        className
      )}
    >
      {/* Shimmer effect */}
      {variant === 'shimmer' && (
        <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      )}

      {/* Pulse dot */}
      {(dot || pulse) && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span 
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                dotColor || "bg-current"
              )} 
            />
          )}
          <span 
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              dotColor || "bg-current"
            )} 
          />
        </span>
      )}

      {/* Icon */}
      {icon && <span className="flex-shrink-0">{icon}</span>}

      {/* Content */}
      <span className="relative z-10">{children}</span>

      {/* Remove button */}
      {removable && (
        <button
          onClick={onRemove}
          className="ml-1 -mr-1 flex-shrink-0 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}

interface BadgeGroupProps {
  children: ReactNode;
  className?: string;
  max?: number;
}

export function BadgeGroup({ children, className, max }: BadgeGroupProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const visibleChildren = max ? childArray.slice(0, max) : childArray;
  const remaining = max ? childArray.length - max : 0;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {visibleChildren}
      {remaining > 0 && (
        <Badge variant="secondary" size="sm">
          +{remaining}
        </Badge>
      )}
    </div>
  );
}
