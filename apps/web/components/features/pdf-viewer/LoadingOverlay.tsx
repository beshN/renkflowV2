'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FileText, X, Loader2, FileUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentFile } from './types';

export interface LoadingOverlayProps {
  /** The file being loaded */
  file?: DocumentFile | null;
  /** Callback when user clicks close */
  onClose?: () => void;
  /** Actual loading progress (0-100), if available from PDF.js */
  actualProgress?: number;
  /** Progress value (0-100) */
  progress?: number;
  /** Estimated file size in bytes for progress calculation */
  fileSize?: number;
  /** Whether loading is complete */
  isComplete?: boolean;
  /** Custom className */
  className?: string;
  /** Loading stage message */
  stage?: LoadingStage;
}

export type LoadingStage = 
  | 'downloading' 
  | 'parsing' 
  | 'rendering' 
  | 'complete';

interface StageConfig {
  icon: React.ReactNode;
  message: string;
  subMessage: string;
}

const stageConfigs: Record<LoadingStage, StageConfig> = {
  downloading: {
    icon: <FileUp className="h-6 w-6" />,
    message: 'Dosya İndiriliyor',
    subMessage: 'PDF dosyası sunucudan alınıyor...',
  },
  parsing: {
    icon: <FileText className="h-6 w-6" />,
    message: 'PDF Ayrıştırılıyor',
    subMessage: '',
  },
  rendering: {
    icon: <Loader2 className="h-6 w-6 animate-spin" />,
    message: 'Görüntü Hazırlanıyor',
    subMessage: 'Sayfalar render ediliyor...',
  },
  complete: {
    icon: <CheckCircle2 className="h-6 w-6" />,
    message: 'Hazır',
    subMessage: 'PDF görüntüleyici açılıyor...',
  },
};

/**
 * Enhanced Loading Overlay Component for PDF Viewer
 * 
 * Features:
 * - Smooth animated progress bar with shimmer effect
 * - Stage-based messaging
 * - Simulated progress that syncs with actual progress
 * - Keyboard accessible close button
 * - Responsive design
 * - Cancel loading capability
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  file,
  onClose,
  actualProgress,
  fileSize,
  isComplete = false,
  className,
  stage = 'downloading',
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<LoadingStage>(stage);
  const progressRef = useRef(0);
  const rafRef = useRef<number>();
  const stageTimeoutRef = useRef<NodeJS.Timeout>();

  // Format file size
  const formatFileSize = useCallback((bytes?: number): string => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }, []);

  // Smooth progress animation
  useEffect(() => {
    if (isComplete) {
      setCurrentStage('complete');
      setDisplayProgress(100);
      return;
    }

    const animate = () => {
      const target = actualProgress ?? progressRef.current;
      const diff = target - displayProgress;
      
      if (Math.abs(diff) > 0.1) {
        setDisplayProgress(prev => prev + diff * 0.1);
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayProgress(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [actualProgress, isComplete, displayProgress]);

  // Simulated progress when no actual progress is provided
  useEffect(() => {
    if (actualProgress !== undefined || isComplete) return;

    const interval = setInterval(() => {
      const currentValue = progressRef.current;
      // Slow down as we approach 90%
      const increment = currentValue < 50 
        ? Math.random() * 8 
        : currentValue < 80 
          ? Math.random() * 4 
          : currentValue < 90 
            ? Math.random() * 1 
            : 0;
      
      progressRef.current = Math.min(currentValue + increment, 95);
    }, 150);

    return () => clearInterval(interval);
  }, [actualProgress, isComplete]);

  // Stage progression simulation
  useEffect(() => {
    if (isComplete) {
      setCurrentStage('complete');
      return;
    }

    // Determine stage based on progress
    const progress = actualProgress ?? displayProgress;
    
    if (progress < 30) {
      setCurrentStage('downloading');
    } else if (progress < 60) {
      setCurrentStage('parsing');
    } else if (progress < 95) {
      setCurrentStage('rendering');
    }
  }, [actualProgress, displayProgress, isComplete]);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const stageConfig = stageConfigs[currentStage];
  const progress = Math.min(Math.round(displayProgress), 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-title"
      aria-describedby="loading-description"
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-slate-900/80 backdrop-blur-sm",
        "animate-in fade-in duration-300",
        className
      )}
    >
      <div 
        className={cn(
          "w-full max-w-md mx-4",
          "bg-white dark:bg-slate-800",
          "rounded-2xl shadow-2xl",
          "border border-slate-200 dark:border-slate-700",
          "overflow-hidden",
          "animate-in zoom-in-95 duration-300"
        )}
      >
        {/* Close button */}
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
            aria-label="Yüklemeyi İptal Et"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 text-center">
          {/* Animated Icon Container */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            {/* Outer ring */}
            <div 
              className={cn(
                "absolute inset-0 rounded-full",
                "border-4 border-slate-100 dark:border-slate-700"
              )}
            />
            
            {/* Progress ring */}
            <svg 
              className="absolute inset-0 w-24 h-24 -rotate-90"
              viewBox="0 0 96 96"
            >
              <circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.76} 276`}
                className={cn(
                  "text-primary transition-all duration-300",
                  isComplete && "text-green-500"
                )}
              />
            </svg>

            {/* Icon */}
            <div 
              className={cn(
                "absolute inset-0 flex items-center justify-center",
                "text-primary",
                isComplete && "text-green-500"
              )}
            >
              <div className={cn(
                "transition-all duration-300",
                currentStage === 'rendering' && "animate-pulse"
              )}>
                {stageConfig.icon}
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 
            id="loading-title"
            className="text-xl font-bold text-slate-900 dark:text-white mb-2"
          >
            {stageConfig.message}
          </h2>

          {/* File name */}
          {file?.name && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 truncate px-4">
              {file.name}
            </p>
          )}

          {/* Stage description */}
          <p 
            id="loading-description"
            className="text-xs text-slate-400 dark:text-slate-500 mb-6"
          >
            {stageConfig.subMessage}
          </p>

          {/* File size info */}
          {(file?.size || fileSize) && (
            <p className="text-[10px] text-slate-400 mb-4 font-mono">
              {file?.size || formatFileSize(fileSize)}
            </p>
          )}

          {/* Progress bar */}
          <div className="w-full space-y-2">
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full relative overflow-hidden",
                  "transition-all duration-300 ease-out",
                  isComplete 
                    ? "bg-green-500" 
                    : "bg-primary"
                )}
                style={{ width: `${progress}%` }}
              >
                {/* Shimmer effect */}
                {!isComplete && (
                  <div 
                    className={cn(
                      "absolute inset-0",
                      "bg-gradient-to-r from-transparent via-white/30 to-transparent",
                      "animate-shimmer"
                    )}
                    style={{
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Progress percentage */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 dark:text-slate-500">
                {currentStage === 'complete' ? 'Tamamlandı' : '…'}
              </span>
              <span className={cn(
                "font-mono font-medium",
                isComplete ? "text-green-500" : "text-slate-600 dark:text-slate-300"
              )}>
                {progress}%
              </span>
            </div>
          </div>

          {/* Cancel button for long operations */}
          {progress < 100 && !isComplete && (
            <button
              onClick={onClose}
              className={cn(
                "mt-6 text-sm",
                "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
                "transition-colors duration-200",
                "focus:outline-none focus:underline"
              )}
            >
              Yüklemeyi İptal Et
            </button>
          )}
        </div>

        {/* Bottom progress indicator */}
        <div 
          className={cn(
            "h-1 w-full",
            "bg-slate-100 dark:bg-slate-700"
          )}
        >
          <div 
            className={cn(
              "h-full transition-all duration-300",
              isComplete ? "bg-green-500" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;
