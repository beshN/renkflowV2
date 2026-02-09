'use client';

import * as React from 'react'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'

type InputProps = React.ComponentProps<'input'> & {
  errorMessage?: string;
  label?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: 'default' | 'filled' | 'ghost' | 'glass';
  inputSize?: 'sm' | 'md' | 'lg';
  success?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ 
  className, 
  type, 
  errorMessage, 
  label, 
  hint,
  leftIcon,
  rightIcon,
  variant = 'default',
  inputSize = 'md',
  success,
  id, 
  ...props 
}, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const errorId = errorMessage ? `${id || 'input'}-error` : undefined
  const hintId = hint ? `${id || 'input'}-hint` : undefined
  const inputId = id || React.useId();
  
  const isPasswordType = type === 'password';
  const inputType = isPasswordType && showPassword ? 'text' : type;

  const variants = {
    default: cn(
      'border border-slate-200/80 dark:border-slate-700/80',
      'bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm',
      'focus:border-primary-500 dark:focus:border-primary-400',
      'focus:ring-4 focus:ring-primary-500/10 dark:focus:ring-primary-400/10'
    ),
    filled: cn(
      'border border-transparent',
      'bg-slate-100/80 dark:bg-slate-800/80',
      'focus:bg-white dark:focus:bg-slate-900',
      'focus:border-primary-500 dark:focus:border-primary-400',
      'focus:ring-4 focus:ring-primary-500/10'
    ),
    ghost: cn(
      'border-b-2 border-slate-200 dark:border-slate-700 rounded-none',
      'bg-transparent',
      'focus:border-primary-500 dark:focus:border-primary-400',
      'focus:ring-0'
    ),
    glass: cn(
      'border border-slate-200/70 dark:border-slate-700/60',
      'bg-white/60 dark:bg-slate-900/60',
      'backdrop-blur-md',
      'focus:bg-white/80 dark:focus:bg-slate-900/80',
      'focus:border-primary-500/80 dark:focus:border-primary-400/80',
      'focus:ring-4 focus:ring-primary-500/10 dark:focus:ring-primary-400/10'
    ),
  };

  const sizes = {
    sm: 'h-9 text-sm px-3',
    md: 'h-11 text-sm px-4',
    lg: 'h-13 text-base px-5',
  };

  const hasError = Boolean(errorMessage);
  const hasSuccess = success && !hasError;

  return (
    <div className="space-y-2">
      {label && (
        <label 
          htmlFor={inputId}
          className={cn(
            'block text-sm font-medium transition-colors',
            hasError ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
          )}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          data-slot="input"
          className={cn(
            'w-full rounded-2xl outline-none transition-all duration-200',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-800/80',
            variants[variant],
            sizes[inputSize],
            leftIcon && 'pl-10',
            (rightIcon || isPasswordType || hasError || hasSuccess) && 'pr-10',
            hasError && 'border-red-500 dark:border-red-400 focus:border-red-500 focus:ring-red-500/10',
            hasSuccess && 'border-emerald-500 dark:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/10',
            className,
          )}
          aria-invalid={hasError || props['aria-invalid']}
          aria-describedby={cn(errorId, hintId) || props['aria-describedby']}
          {...props}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
          {hasError && <AlertCircle size={18} className="text-red-500" />}
          {hasSuccess && <CheckCircle2 size={18} className="text-emerald-500" />}
          {rightIcon && !hasError && !hasSuccess && !isPasswordType && rightIcon}
        </div>
      </div>
      {(errorMessage || hint) && (
        <p 
          id={errorMessage ? errorId : hintId} 
          className={cn(
            'text-xs flex items-center gap-1',
            hasError ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          {errorMessage || hint}
        </p>
      )}
    </div>
  )
});

Input.displayName = 'Input';

export { Input }
