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
    'inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-all duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    'active:scale-[0.98] select-none'
  );

  const variants = {
    default: 'bg-[#007AFF] hover:bg-[#0071E3] text-white shadow-sm hover:shadow-md border border-transparent',
    // Apple Style: Solid Blue (System Blue)
    primary: 'bg-[#007AFF] hover:bg-[#0071E3] text-white shadow-sm hover:shadow-md border border-transparent',
    // Apple Style: Gray/Neutral background
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm border border-transparent',
    // Apple Style: White with border
    outline: 'bg-transparent border border-input hover:bg-accent hover:text-accent-foreground',
    // Apple Style: Text only
    ghost: 'bg-transparent hover:bg-accent hover:text-accent-foreground text-foreground',
    // Apple Style: Red (Destructive)
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
    // Apple Style: Green (Success)
    success: 'bg-[#34C759] hover:bg-[#2DB84D] text-white shadow-sm',
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
    default: 'rounded-lg', // Slightly more rounded than standard, less than full
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
