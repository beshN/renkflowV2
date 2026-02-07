// ============================================
// LOADING & SKELETON COMPONENTS
// Shimmer animations and loading states
// ============================================

'use client';

import { type ReactNode, type CSSProperties } from 'react';

// ============================================
// SKELETON BASE
// ============================================

interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animate?: boolean;
}

export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md',
  animate = true,
}: SkeletonProps) {
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  const style: CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`
        bg-gray-200 
        ${roundedClasses[rounded]} 
        ${animate ? 'animate-pulse' : ''} 
        ${className}
      `}
      style={style}
    />
  );
}

// ============================================
// SKELETON TEXT
// ============================================

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

export function SkeletonText({ 
  lines = 3, 
  className = '',
  lastLineWidth = '60%',
}: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 ? lastLineWidth : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  );
}

// ============================================
// SKELETON AVATAR
// ============================================

interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function SkeletonAvatar({ size = 'md', className = '' }: SkeletonAvatarProps) {
  const sizes = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  return (
    <Skeleton
      width={sizes[size]}
      height={sizes[size]}
      rounded="full"
      className={className}
    />
  );
}

// ============================================
// SKELETON CARD
// ============================================

interface SkeletonCardProps {
  hasImage?: boolean;
  hasAvatar?: boolean;
  lines?: number;
  className?: string;
}

export function SkeletonCard({
  hasImage = true,
  hasAvatar = true,
  lines = 2,
  className = '',
}: SkeletonCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${className}`}>
      {hasImage && (
        <Skeleton height={200} width="100%" rounded="none" />
      )}
      
      <div className="p-4">
        {hasAvatar && (
          <div className="flex items-center gap-3 mb-4">
            <SkeletonAvatar size="sm" />
            <div className="flex-1 space-y-1">
              <Skeleton height={14} width="40%" rounded="sm" />
              <Skeleton height={12} width="25%" rounded="sm" />
            </div>
          </div>
        )}
        
        <Skeleton height={20} width="80%" rounded="sm" className="mb-3" />
        <SkeletonText lines={lines} />
      </div>
    </div>
  );
}

// ============================================
// SKELETON TABLE
// ============================================

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
}: SkeletonTableProps) {
  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-50 border-b px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton 
            key={i} 
            height={16} 
            width={`${100 / columns}%`} 
            rounded="sm" 
          />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className="px-4 py-3 flex gap-4 border-b last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              height={14} 
              width={`${100 / columns}%`} 
              rounded="sm" 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================
// SKELETON LIST
// ============================================

interface SkeletonListProps {
  items?: number;
  hasAvatar?: boolean;
  className?: string;
}

export function SkeletonList({
  items = 5,
  hasAvatar = true,
  className = '',
}: SkeletonListProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg">
          {hasAvatar && <SkeletonAvatar size="md" />}
          <div className="flex-1 space-y-2">
            <Skeleton height={16} width="70%" rounded="sm" />
            <Skeleton height={12} width="40%" rounded="sm" />
          </div>
          <Skeleton height={32} width={80} rounded="md" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// SPINNER
// ============================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
}

export function Spinner({ size = 'md', color = 'primary', className = '' }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const colors = {
    primary: 'border-blue-200 border-t-blue-600',
    secondary: 'border-gray-200 border-t-gray-600',
    white: 'border-white/30 border-t-white',
  };

  return (
    <div
      className={`
        ${sizes[size]}
        ${colors[color]}
        rounded-full animate-spin
        ${className}
      `}
    />
  );
}

// ============================================
// LOADING OVERLAY
// ============================================

interface LoadingOverlayProps {
  isLoading: boolean;
  children: ReactNode;
  message?: string;
  blur?: boolean;
}

export function LoadingOverlay({
  isLoading,
  children,
  message,
  blur = true,
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      
      {isLoading && (
        <div 
          className={`
            absolute inset-0 flex flex-col items-center justify-center
            bg-white/80 z-50
            ${blur ? 'backdrop-blur-sm' : ''}
          `}
        >
          <Spinner size="lg" />
          {message && (
            <p className="mt-3 text-gray-600 font-medium">{message}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// BUTTON LOADING STATE
// ============================================

interface LoadingButtonProps {
  isLoading: boolean;
  children: ReactNode;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function LoadingButton({
  isLoading,
  children,
  loadingText = 'Yükleniyor...',
  disabled,
  className = '',
  onClick,
  type = 'button',
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`
        relative inline-flex items-center justify-center gap-2
        px-4 py-2 rounded-lg font-medium transition-all
        disabled:opacity-60 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isLoading && <Spinner size="sm" color="white" />}
      <span className={isLoading ? 'opacity-0' : ''}>
        {children}
      </span>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          {loadingText}
        </span>
      )}
    </button>
  );
}

// ============================================
// PROGRESS BAR
// ============================================

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  color = 'primary',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colors = {
    primary: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-500',
    error: 'bg-red-600',
  };

  return (
    <div className={className}>
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className={`${colors[color]} ${sizes[size]} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-sm text-gray-600 mt-1 text-right">
          {Math.round(percentage)}%
        </p>
      )}
    </div>
  );
}

// ============================================
// CONTENT PLACEHOLDER
// ============================================

interface ContentPlaceholderProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function ContentPlaceholder({
  icon,
  title,
  description,
  action,
  className = '',
}: ContentPlaceholderProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      {icon && (
        <div className="w-16 h-16 mb-4 text-gray-300">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-gray-500 mb-4 max-w-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
