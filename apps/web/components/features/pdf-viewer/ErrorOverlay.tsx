'use client';

import React, { useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, X, FileWarning, WifiOff, Lock, FileX } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ErrorType = 'network' | 'corrupt' | 'password' | 'not-found' | 'unknown';

export interface ErrorOverlayProps {
  /** Callback when user clicks retry button */
  onRetry: () => void;
  /** Callback when user clicks close button */
  onClose: () => void;
  /** Error message to display */
  message?: string;
  /** Type of error for appropriate icon and messaging */
  errorType?: ErrorType;
  /** Number of retry attempts made */
  retryCount?: number;
  /** Maximum allowed retry attempts */
  maxRetries?: number;
  /** Additional actions to show */
  additionalActions?: React.ReactNode;
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Custom className for the overlay */
  className?: string;
}

interface ErrorConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

const errorConfigs: Record<ErrorType, ErrorConfig> = {
  network: {
    icon: <WifiOff className="h-10 w-10" />,
    title: 'Bağlantı hatası',
    description: 'PDF dosyasına erişilemiyor. İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
  },
  corrupt: {
    icon: <FileWarning className="h-10 w-10" />,
    title: 'Bozuk dosya',
    description: 'PDF dosyası bozuk veya desteklenmeyen bir formatta. Lütfen farklı bir dosya deneyin.',
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  password: {
    icon: <Lock className="h-10 w-10" />,
    title: 'Şifre korumalı',
    description: 'Bu PDF dosyası şifre korumalı. Şifreyi kaldırıp tekrar yüklemeyi deneyin.',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  'not-found': {
    icon: <FileX className="h-10 w-10" />,
    title: 'Dosya bulunamadı',
    description: 'İstenen PDF dosyası sunucuda bulunamadı. Dosyanın mevcut olduğundan emin olun.',
    color: 'text-slate-500',
    bgColor: 'bg-slate-50 dark:bg-slate-900/20',
  },
  unknown: {
    icon: <AlertCircle className="h-10 w-10" />,
    title: 'Yükleme hatası',
    description: 'PDF yüklenirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
};

/**
 * Enhanced Error Overlay Component for PDF Viewer
 * 
 * Features:
 * - Accessible with ARIA labels and keyboard navigation
 * - Animated entrance/exit
 * - Contextual error types with appropriate icons
 * - Retry limit handling
 * - Focus trap for accessibility
 */
export const ErrorOverlay: React.FC<ErrorOverlayProps> = ({
  onRetry,
  onClose,
  message,
  errorType = 'unknown',
  retryCount = 0,
  maxRetries = 3,
  additionalActions,
  showCloseButton = true,
  className,
}) => {
  const config = errorConfigs[errorType];
  const canRetry = retryCount < maxRetries;
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Store previous focus for restoration
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    // Focus the overlay container
    overlayRef.current?.focus();
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = '';
      // Restore focus
      previousFocusRef.current?.focus();
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Trap focus within overlay
  const handleTabKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !overlayRef.current) return;

    const focusableElements = overlayRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  }, []);

  return (
    <div
      ref={overlayRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="error-title"
      aria-describedby="error-description"
      tabIndex={-1}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-slate-900/80 backdrop-blur-sm",
        "animate-in fade-in duration-200",
        className
      )}
      onKeyDown={(e) => {
        handleKeyDown(e);
        handleTabKey(e);
      }}
    >
      <div 
        className={cn(
          "w-full max-w-md mx-4",
          "bg-white dark:bg-slate-800",
          "rounded-2xl shadow-2xl",
          "border border-slate-200 dark:border-slate-700",
          "overflow-hidden",
          "animate-in zoom-in-95 duration-200"
        )}
      >
        {/* Header with close button */}
        {showCloseButton && (
          <div className="flex justify-end p-4 pb-0">
            <button
              onClick={onClose}
              className={cn(
                "p-2 rounded-full",
                "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
                "hover:bg-slate-100 dark:hover:bg-slate-700",
                "transition-colors duration-200",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
              aria-label="Kapat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-8 pb-8 text-center">
          {/* Icon */}
          <div 
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6",
              "transition-transform duration-300 hover:scale-105",
              config.bgColor,
              config.color
            )}
            aria-hidden="true"
          >
            {config.icon}
          </div>

          {/* Title */}
          <h2 
            id="error-title"
            className="text-2xl font-bold text-slate-900 dark:text-white mb-3"
          >
            {config.title}
          </h2>

          {/* Description */}
          <p 
            id="error-description"
            className="text-slate-500 dark:text-slate-400 mb-2"
          >
            {config.description}
          </p>

          {/* Custom message if provided */}
          {message && (
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 font-mono bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
              {message}
            </p>
          )}

          {/* Retry count indicator */}
          {retryCount > 0 && (
            <p className="text-xs text-slate-400 mb-4">
              Deneme: {retryCount}/{maxRetries}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            {showCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  "px-6 py-2.5 rounded-xl",
                  "border border-slate-200 dark:border-slate-700",
                  "text-slate-700 dark:text-slate-300 font-medium",
                  "hover:bg-slate-50 dark:hover:bg-slate-700",
                  "transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                )}
              >
                Kapat
              </button>
            )}
            
            {canRetry ? (
              <button
                onClick={onRetry}
                className={cn(
                  "px-6 py-2.5 rounded-xl",
                  "bg-primary text-white font-medium",
                  "shadow-lg shadow-primary/30",
                  "hover:bg-primary/90 hover:shadow-primary/40",
                  "active:scale-95",
                  "transition-all duration-200",
                  "flex items-center justify-center gap-2",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                )}
              >
                <RefreshCw className="h-4 w-4" />
                Tekrar dene
              </button>
            ) : (
              <button
                disabled
                className={cn(
                  "px-6 py-2.5 rounded-xl",
                  "bg-slate-300 dark:bg-slate-700",
                  "text-slate-500 dark:text-slate-400 font-medium",
                  "cursor-not-allowed"
                )}
              >
                Maksimum deneme
              </button>
            )}
          </div>

          {/* Additional actions */}
          {additionalActions && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              {additionalActions}
            </div>
          )}
        </div>

        {/* Progress bar for retry limit */}
        <div className="h-1 bg-slate-100 dark:bg-slate-700">
          <div 
            className={cn(
              "h-full transition-all duration-300",
              retryCount >= maxRetries 
                ? "bg-red-500 w-full" 
                : "bg-primary",
              canRetry && "bg-primary"
            )}
            style={{ 
              width: canRetry 
                ? `${(retryCount / maxRetries) * 100}%` 
                : '100%' 
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ErrorOverlay;
