import * as React from 'react'
import { cn } from '@/lib/utils'

type InputProps = React.ComponentProps<'input'> & {
  errorMessage?: string;
  label?: string;
}

function Input({ className, type, errorMessage, label, id, ...props }: InputProps) {
  const errorId = errorMessage ? `${id || 'input'}-error` : undefined
  const inputId = id || React.useId();

  return (
    <div className="space-y-1.5">
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        data-slot="input"
        className={cn(
          'input-professional h-10 text-base md:text-sm w-full',
          'aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500',
          className,
        )}
        aria-invalid={Boolean(errorMessage) || props['aria-invalid']}
        aria-describedby={errorId || props['aria-describedby']}
        {...props}
      />
      {errorMessage && (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  )
}

export { Input }
