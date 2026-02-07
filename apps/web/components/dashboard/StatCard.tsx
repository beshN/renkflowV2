'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  linkText?: string;
  linkHref?: string;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  trend,
  linkText,
  linkHref,
  icon,
  className,
}: StatCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 min-h-[200px] min-w-[320px] flex-1 flex flex-col",
      className
    )}>
      {/* Title */}
      <div className="pb-4">
        <h3 className="text-xl font-semibold text-gray-900 tracking-tight">{title}</h3>
      </div>

      {/* Value with trend */}
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-medium text-gray-900 tracking-tighter">{value}</span>
        {trend && (
          <div className={cn(
            "flex items-center",
            trend === 'up' && "text-green-500",
            trend === 'down' && "text-red-500"
          )}>
            {trend === 'up' ? (
              <TrendingUp className="w-8 h-8" strokeWidth={2} />
            ) : trend === 'down' ? (
              <TrendingDown className="w-8 h-8" strokeWidth={2} />
            ) : null}
          </div>
        )}
        {icon}
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-500 mt-2 tracking-tight">{description}</p>
      )}

      {/* Link */}
      {linkText && (
        <div className="flex-1 flex items-end pt-4">
          <a 
            href={linkHref || '#'} 
            className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 transition-colors"
          >
            {linkText}
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

interface QuarterGoalCardProps {
  percentage: number;
  linkText?: string;
  linkHref?: string;
  className?: string;
}

export function QuarterGoalCard({
  percentage,
  linkText = "Tüm hedefler",
  linkHref,
  className,
}: QuarterGoalCardProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 min-h-[200px] min-w-[260px] flex flex-col items-center",
      className
    )}>
      {/* Title */}
      <div className="pb-4 w-full text-center">
        <h3 className="text-xl font-semibold text-gray-900 tracking-tight">Çeyrek Hedef</h3>
      </div>

      {/* Circular Progress */}
      <div className="relative w-[120px] h-[60px] overflow-hidden">
        <svg 
          className="absolute -top-[60px] left-0 w-[120px] h-[120px] -rotate-90"
          viewBox="0 0 100 100"
        >
          {/* Background arc */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#FFF7E8"
            strokeWidth="8"
            strokeDasharray={circumference / 2}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#FFCD71"
            strokeWidth="8"
            strokeDasharray={circumference / 2}
            strokeDashoffset={(circumference / 2) - (percentage / 100) * (circumference / 2)}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-3xl font-medium text-gray-900 tracking-tighter">
          {percentage}%
        </div>
      </div>

      {/* Link */}
      {linkText && (
        <div className="flex-1 flex items-end pt-4">
          <a 
            href={linkHref || '#'} 
            className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 transition-colors"
          >
            {linkText}
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

interface MiniStatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  avatar?: ReactNode;
  className?: string;
}

export function MiniStatCard({
  title,
  value,
  subtitle,
  avatar,
  className,
}: MiniStatCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-2xl p-4 flex-1 flex flex-col min-h-[120px]",
      className
    )}>
      <p className="text-base font-semibold text-gray-500 tracking-tight">{title}</p>
      <div className="flex-1 flex flex-col justify-end mt-4">
        {avatar && <div className="mb-2">{avatar}</div>}
        <p className="text-2xl font-semibold text-amber-700 tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-sm font-normal text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
