import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getOrderStatusInfo } from '@/lib/utils';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  status?: string;
  className?: string;
}

export function Badge({ children, variant = 'default', status, className }: BadgeProps) {
  // If status is provided, use status-specific styling
  if (status) {
    const statusInfo = getOrderStatusInfo(status);
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-slate-900/5 dark:ring-white/10',
          statusInfo.bgColor,
          statusInfo.color,
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-current"></span>
        {children}
      </span>
    );
  }

  // Default variant  styling
  const variants = {
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
    success: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
    warning: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
    danger: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-slate-900/5 dark:ring-white/10',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
