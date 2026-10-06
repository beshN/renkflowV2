'use client';

import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'link' | 'default';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  isLoading?: boolean;
  loadingText?: string;
  /** Backward-compatible alias for leftIcon. */
  icon?: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  rounded?: 'default' | 'full' | 'none';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  className,
  children,
  isLoading = false,
  loadingText,
  icon,
  leftIcon,
  rightIcon,
  rounded = 'default',
  disabled,
  ...props
}, ref) => {

  const baseStyles = cn(
    'inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-colors duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'active:translate-y-px select-none'
  );

  const variants = {
    default: 'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(17_17_19/0.1)] hover:bg-primary/90',
    primary: 'bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(17_17_19/0.1)] hover:bg-primary/90',
    secondary: 'bg-card text-foreground border border-border shadow-sm hover:bg-accent hover:border-primary/30',
    outline: 'bg-transparent border border-input hover:bg-accent hover:text-accent-foreground',
    ghost: 'bg-transparent hover:bg-accent hover:text-accent-foreground text-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm',
    link: 'text-primary underline-offset-4 hover:underline px-0 py-0 h-auto',
  };

  const sizes = {
    xs: 'px-2.5 py-1 text-xs h-7',
    sm: 'px-3.5 py-1.5 text-sm h-8',
    md: 'px-5 py-2.5 text-sm h-10',
    lg: 'px-6 py-3 text-base h-12',
    xl: 'px-8 py-4 text-lg h-14',
    icon: 'h-10 w-10 p-0',
  };

  const roundedStyles = {
    default: 'rounded-lg',
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
        className
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText && <span>{loadingText}</span>}
        </>
      ) : (
        <>
          {(leftIcon || icon) && <span className="inline-flex shrink-0">{leftIcon || icon}</span>}
          {children}
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
