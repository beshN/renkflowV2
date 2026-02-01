'use client';

/**
 * AdvancedStatsCard - Professional statistics card with animations
 * 
 * Features:
 * - Animated counters
 * - Trend indicators with sparkline
 * - Mini charts
 * - Comparison metrics
 * - Loading states
 * - Click interactions
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useInView, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  AlertCircle,
  LucideIcon,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface TrendData {
  value: number;
  isPositive: boolean;
  label?: string;
}

interface SparklineData {
  values: number[];
  color?: string;
}

interface ComparisonData {
  current: number;
  previous: number;
  label: string;
}

interface AdvancedStatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: TrendData;
  sparkline?: SparklineData;
  comparison?: ComparisonData;
  format?: 'number' | 'currency' | 'percentage';
  currency?: string;
  loading?: boolean;
  error?: string;
  onClick?: () => void;
  href?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gradient' | 'outlined' | 'glass';
}

// ============================================
// Animated Counter
// ============================================

const AnimatedCounter: React.FC<{
  value: number;
  format?: 'number' | 'currency' | 'percentage';
  currency?: string;
  duration?: number;
}> = ({ value, format = 'number', currency = '₺', duration = 1 }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const springValue = useSpring(0, { duration: duration * 1000 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      springValue.set(value);
    }
  }, [isInView, value, springValue]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      setDisplayValue(latest);
    });
    return () => unsubscribe();
  }, [springValue]);

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return `${currency}${Math.round(val).toLocaleString('tr-TR')}`;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return Math.round(val).toLocaleString('tr-TR');
    }
  };

  return <span ref={ref}>{formatValue(displayValue)}</span>;
};

// ============================================
// Mini Sparkline Chart
// ============================================

const Sparkline: React.FC<{
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}> = ({ data, color = '#3B82F6', width = 80, height = 24 }) => {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkline-gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polygon
        points={areaPoints}
        fill={`url(#sparkline-gradient-${color})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      <motion.circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="2.5"
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1 }}
      />
    </svg>
  );
};

// ============================================
// Trend Badge
// ============================================

const TrendBadge: React.FC<{ trend: TrendData }> = ({ trend }) => {
  const Icon = trend.value === 0 ? Minus : trend.isPositive ? TrendingUp : TrendingDown;
  const ArrowIcon = trend.isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        trend.value === 0
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          : trend.isPositive
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
      )}
    >
      <ArrowIcon className="w-3 h-3" />
      <span>{Math.abs(trend.value)}%</span>
      {trend.label && <span className="text-[10px] opacity-70">{trend.label}</span>}
    </motion.div>
  );
};

// ============================================
// Comparison Bar
// ============================================

const ComparisonBar: React.FC<{ comparison: ComparisonData }> = ({ comparison }) => {
  const total = comparison.current + comparison.previous;
  const currentPercentage = (comparison.current / total) * 100;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">{comparison.label}</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {comparison.current.toLocaleString('tr-TR')} / {comparison.previous.toLocaleString('tr-TR')}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${currentPercentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

// ============================================
// Loading Skeleton
// ============================================

const LoadingSkeleton: React.FC<{ size: 'sm' | 'md' | 'lg' }> = ({ size }) => (
  <div className="animate-pulse space-y-3">
    <div className="flex items-center justify-between">
      <div className={cn(
        'bg-gray-200 dark:bg-gray-700 rounded',
        size === 'sm' ? 'h-4 w-20' : size === 'lg' ? 'h-5 w-28' : 'h-4 w-24'
      )} />
      <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
    <div className={cn(
      'bg-gray-200 dark:bg-gray-700 rounded',
      size === 'sm' ? 'h-7 w-16' : size === 'lg' ? 'h-10 w-28' : 'h-8 w-20'
    )} />
    <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
  </div>
);

// ============================================
// Main Component
// ============================================

export function AdvancedStatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-500',
  trend,
  sparkline,
  comparison,
  format = 'number',
  currency = '₺',
  loading = false,
  error,
  onClick,
  href,
  className,
  size = 'md',
  variant = 'default',
}: AdvancedStatsCardProps) {
  const isNumericValue = typeof value === 'number';

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  const valueSizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const variantClasses = {
    default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800',
    gradient: 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200/50 dark:border-gray-700/50',
    outlined: 'bg-transparent border-2 border-gray-200 dark:border-gray-700',
    glass: 'bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50',
  };

  const Wrapper = href ? motion.a : motion.div;
  const wrapperProps = href ? { href } : {};

  if (error) {
    return (
      <div className={cn(
        'rounded-2xl',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}>
        <div className="flex items-center gap-3 text-red-500">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <Wrapper
      {...wrapperProps}
      onClick={onClick}
      className={cn(
        'block rounded-2xl transition-all duration-300',
        sizeClasses[size],
        variantClasses[variant],
        (onClick || href) && 'cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
      whileHover={onClick || href ? { y: -2 } : undefined}
      whileTap={onClick || href ? { scale: 0.98 } : undefined}
    >
      {loading ? (
        <LoadingSkeleton size={size} />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {title}
              </h3>
              {trend && <TrendBadge trend={trend} />}
            </div>
            {Icon && (
              <div className={cn(
                'p-2 rounded-xl bg-gray-100 dark:bg-gray-800',
                iconColor
              )}>
                <Icon className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Value */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className={cn(
                'font-bold text-gray-900 dark:text-white',
                valueSizeClasses[size]
              )}>
                {isNumericValue ? (
                  <AnimatedCounter
                    value={value}
                    format={format}
                    currency={currency}
                  />
                ) : (
                  value
                )}
              </p>
              {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Sparkline */}
            {sparkline && (
              <Sparkline
                data={sparkline.values}
                color={sparkline.color}
                width={size === 'lg' ? 100 : size === 'sm' ? 60 : 80}
                height={size === 'lg' ? 32 : size === 'sm' ? 20 : 24}
              />
            )}
          </div>

          {/* Comparison */}
          {comparison && <ComparisonBar comparison={comparison} />}
        </>
      )}
    </Wrapper>
  );
}

// ============================================
// Stats Grid Component
// ============================================

interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  const colClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', colClasses[columns], className)}>
      {children}
    </div>
  );
}

export default AdvancedStatsCard;
