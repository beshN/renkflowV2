'use client';

/**
 * Enterprise Finance Stats Card Component
 * Animated stats card with trend indicator and sparkline
 */

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Sparkline } from './MiniChart';
import { formatFinanceCurrency, formatCompactCurrency } from '@/lib/utils/finance';

export interface FinanceStatsCardProps {
  title: string;
  value: number;
  currency?: string;
  previousValue?: number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  icon: ReactNode;
  iconBgClass?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  compact?: boolean;
  className?: string;
}

export function FinanceStatsCard({
  title,
  value,
  currency = 'TRY',
  previousValue,
  trend,
  trendValue,
  icon,
  iconBgClass = 'bg-gradient-to-br from-blue-400 to-blue-600',
  sparklineData,
  sparklineColor = '#3b82f6',
  subtitle,
  badge,
  badgeColor = 'bg-slate-100 text-slate-600',
  href,
  onClick,
  loading = false,
  compact = false,
  className,
}: FinanceStatsCardProps) {
  // Calculate trend if not provided
  const calculatedTrend = trend || (previousValue !== undefined
    ? value > previousValue ? 'up' : value < previousValue ? 'down' : 'neutral'
    : 'neutral');

  const calculatedTrendValue = trendValue ?? (previousValue && previousValue > 0
    ? ((value - previousValue) / previousValue) * 100
    : 0);

  const trendConfig = {
    up: { 
      icon: TrendingUp, 
      color: 'text-green-600', 
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      label: '+',
    },
    down: { 
      icon: TrendingDown, 
      color: 'text-red-600', 
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      label: '',
    },
    neutral: { 
      icon: Minus, 
      color: 'text-slate-500', 
      bgColor: 'bg-slate-100 dark:bg-slate-800',
      label: '',
    },
  };

  const trendInfo = trendConfig[calculatedTrend];
  const TrendIcon = trendInfo.icon;

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm',
        'hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300',
        (href || onClick) && 'cursor-pointer',
        compact ? 'p-4' : 'p-6',
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          'rounded-xl flex items-center justify-center text-white shadow-lg',
          iconBgClass,
          compact ? 'w-10 h-10' : 'w-12 h-12'
        )}>
          {icon}
        </div>
        
        <div className="flex items-center gap-2">
          {badge && (
            <span className={cn(
              'text-xs font-medium px-2 py-1 rounded-full',
              badgeColor
            )}>
              {badge}
            </span>
          )}
          
          {calculatedTrendValue !== 0 && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
              trendInfo.bgColor,
              trendInfo.color
            )}>
              <TrendIcon size={12} />
              <span>
                {trendInfo.label}{Math.abs(calculatedTrendValue).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <p className={cn(
        'text-slate-500 dark:text-slate-400 mb-1',
        compact ? 'text-xs' : 'text-sm'
      )}>
        {title}
      </p>

      {/* Value */}
      {loading ? (
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-32" />
      ) : (
        <p className={cn(
          'font-bold text-slate-900 dark:text-white',
          compact ? 'text-xl' : 'text-2xl'
        )}>
          {compact 
            ? formatCompactCurrency(value, currency)
            : formatFinanceCurrency(value, currency)
          }
        </p>
      )}

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Sparkline 
            data={sparklineData} 
            color={sparklineColor}
            width={100}
            height={24}
          />
          <span className="text-xs text-slate-400">Son 7 gün</span>
        </div>
      )}
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  return content;
}

// ============================================
// Stats Card Grid
// ============================================

interface StatsCardGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsCardGrid({ children, columns = 4, className }: StatsCardGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  );
}

// ============================================
// Mini Stats Card (for inline use)
// ============================================

interface MiniStatsCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MiniStatsCard({ label, value, icon, trend, className }: MiniStatsCardProps) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-slate-600',
  };

  return (
    <div className={cn(
      'bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 flex items-center gap-3',
      className
    )}>
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
          {icon}
        </div>
      )}
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={cn(
          'font-semibold',
          trend ? trendColors[trend] : 'text-slate-900 dark:text-white'
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Comparison Card
// ============================================

interface ComparisonCardProps {
  title: string;
  current: number;
  previous: number;
  currency?: string;
  period?: string;
  className?: string;
}

export function ComparisonCard({
  title,
  current,
  previous,
  currency = 'TRY',
  period = 'önceki dönem',
  className,
}: ComparisonCardProps) {
  const diff = current - previous;
  const diffPercent = previous > 0 ? (diff / previous) * 100 : 0;
  const isPositive = diff >= 0;

  return (
    <div className={cn(
      'bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4',
      className
    )}>
      <p className="text-sm text-slate-500 mb-2">{title}</p>
      
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatFinanceCurrency(current, currency)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {period}: {formatFinanceCurrency(previous, currency)}
          </p>
        </div>
        
        <div className={cn(
          'text-right',
          isPositive ? 'text-green-600' : 'text-red-600'
        )}>
          <div className="flex items-center gap-1">
            {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="font-semibold">{diffPercent.toFixed(1)}%</span>
          </div>
          <p className="text-xs">
            {isPositive ? '+' : ''}{formatFinanceCurrency(diff, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
