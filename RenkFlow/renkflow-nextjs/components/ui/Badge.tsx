import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getOrderStatusInfo } from '@/lib/utils';

const sizes = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary' | 'outline';
  status?: string;
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'default', 
  status, 
  size = 'sm',
  dot = false,
  removable = false,
  onRemove,
  icon,
  className 
}: BadgeProps) {
  // If status is provided, use status-specific styling
  if (status) {
    const statusInfo = getOrderStatusInfo(status);
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium transition-all',
          'ring-1 ring-inset ring-slate-900/5 dark:ring-white/10',
          sizes[size],
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

  const variants = {
    default: cn(
      'bg-slate-100 dark:bg-slate-800',
      'text-slate-700 dark:text-slate-300',
      'ring-1 ring-slate-200/50 dark:ring-slate-700/50'
    ),
    primary: cn(
      'bg-gradient-to-r from-sky-500/10 to-blue-500/10',
      'text-sky-700 dark:text-sky-300',
      'ring-1 ring-sky-500/20'
    ),
    secondary: cn(
      'bg-slate-900 dark:bg-white',
      'text-white dark:text-slate-900'
    ),
    success: cn(
      'bg-emerald-50 dark:bg-emerald-900/30',
      'text-emerald-700 dark:text-emerald-300',
      'ring-1 ring-emerald-500/20'
    ),
    warning: cn(
      'bg-amber-50 dark:bg-amber-900/30',
      'text-amber-700 dark:text-amber-300',
      'ring-1 ring-amber-500/20'
    ),
    danger: cn(
      'bg-red-50 dark:bg-red-900/30',
      'text-red-700 dark:text-red-300',
      'ring-1 ring-red-500/20'
    ),
    info: cn(
      'bg-blue-50 dark:bg-blue-900/30',
      'text-blue-700 dark:text-blue-300',
      'ring-1 ring-blue-500/20'
    ),
    outline: cn(
      'bg-transparent',
      'text-slate-700 dark:text-slate-300',
      'ring-1 ring-slate-300 dark:ring-slate-600'
    ),
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium transition-all',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={cn(
          'rounded-full bg-current',
          size === 'xs' ? 'size-1' : size === 'sm' ? 'size-1.5' : 'size-2'
        )} />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {removable && (
        <button 
          onClick={onRemove}
          className="ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Kaldır"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}
