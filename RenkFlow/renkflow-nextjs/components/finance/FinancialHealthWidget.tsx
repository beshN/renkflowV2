'use client';

/**
 * Financial Health Widget
 * Gives a quick overview score of financial health based on key metrics
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Activity, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

interface FinancialHealthProps {
  score: number; // 0-100
  metrics: {
    label: string;
    status: 'good' | 'warning' | 'critical';
    message: string;
  }[];
  className?: string;
}

export function FinancialHealthWidget({ score, metrics, className }: FinancialHealthProps) {
  const healthStatus = useMemo(() => {
    if (score >= 80) return { label: 'Mükemmel', color: 'text-green-600', bg: 'bg-green-500' };
    if (score >= 60) return { label: 'İyi', color: 'text-blue-600', bg: 'bg-blue-500' };
    if (score >= 40) return { label: 'Orta', color: 'text-orange-600', bg: 'bg-orange-500' };
    return { label: 'Kritik', color: 'text-red-600', bg: 'bg-red-500' };
  }, [score]);

  const circumference = 2 * Math.PI * 40; // r=40
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={cn(
      'bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6',
      className
    )}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity size={20} className="text-blue-600" />
          Finansal Sağlık
        </h3>
        <span className={cn('px-3 py-1 rounded-full text-xs font-bold uppercase', healthStatus.color.replace('text-', 'bg-').replace('600', '100'), healthStatus.color)}>
          {healthStatus.label}
        </span>
      </div>

      <div className="flex items-start gap-8">
        {/* Score Ring */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background Ring */}
            <circle
              cx="64"
              cy="64"
              r="40"
              fill="none"
              stroke="currentColor"
              className="text-slate-100 dark:text-slate-800"
              strokeWidth="8"
            />
            {/* Foreground Ring */}
            <circle
              cx="64"
              cy="64"
              r="40"
              fill="none"
              stroke="currentColor"
              className={healthStatus.color}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-3xl font-bold', healthStatus.color)}>
              {score}
            </span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
        </div>

        {/* Metrics List */}
        <div className="flex-1 space-y-3">
          {metrics.map((metric, i) => (
            <div key={i} className="flex items-start gap-3">
              {metric.status === 'good' ? (
                <CheckCircle size={16} className="text-green-500 mt-0.5" />
              ) : metric.status === 'warning' ? (
                <AlertCircle size={16} className="text-orange-500 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-red-500 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {metric.label}
                </p>
                <p className="text-xs text-slate-500">
                  {metric.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
