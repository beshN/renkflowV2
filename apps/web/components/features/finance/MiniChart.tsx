'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mini Chart Components
 * Lightweight, CSS-based charts without external dependencies
 */

interface MiniBarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  showLabels?: boolean;
  className?: string;
}

export function MiniBarChart({ 
  data, 
  height = 120, 
  color = 'bg-blue-500',
  showLabels = true,
  className 
}: MiniBarChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);

  return (
    <div className={cn('flex items-end gap-1', className)} style={{ height }}>
      {data.map((item, i) => {
        const barHeight = (item.value / maxValue) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div 
              className={cn('w-full rounded-t-sm transition-all duration-500', color)}
              style={{ 
                height: `${barHeight}%`,
                minHeight: item.value > 0 ? '4px' : '0px',
              }}
            />
            {showLabels && (
              <span className="text-[10px] text-slate-400 truncate w-full text-center">
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface MiniLineChartProps {
  data: number[];
  height?: number;
  color?: string;
  fillColor?: string;
  className?: string;
}

export function MiniLineChart({ 
  data, 
  height = 60, 
  color = 'stroke-blue-500',
  fillColor = 'fill-blue-500/10',
  className 
}: MiniLineChartProps) {
  const { path, area } = useMemo(() => {
    if (data.length < 2) return { path: '', area: '' };
    
    const maxValue = Math.max(...data, 1);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;
    
    const points = data.map((value, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((value - minValue) / range) * 100;
      return { x, y };
    });

    const pathD = points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');

    const areaD = `${pathD} L 100 100 L 0 100 Z`;

    return { path: pathD, area: areaD };
  }, [data]);

  if (data.length < 2) {
    return (
      <div className={cn('flex items-center justify-center text-slate-400 text-sm', className)} style={{ height }}>
        Yetersiz veri
      </div>
    );
  }

  return (
    <svg 
      viewBox="0 0 100 100" 
      preserveAspectRatio="none"
      className={cn('w-full', className)}
      style={{ height }}
    >
      <path d={area} className={fillColor} />
      <path 
        d={path} 
        fill="none" 
        className={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface MiniDonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function MiniDonutChart({ 
  data, 
  size = 100, 
  strokeWidth = 12,
  className 
}: MiniDonutChartProps) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  
  const segments = useMemo(() => {
    let cumulativePercent = 0;
    return data.map(item => {
      const percent = total > 0 ? (item.value / total) * 100 : 0;
      const segment = {
        ...item,
        percent,
        offset: cumulativePercent,
      };
      cumulativePercent += percent;
      return segment;
    });
  }, [data, total]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-slate-100 dark:text-slate-800"
          strokeWidth={strokeWidth}
        />
        {segments.map((segment, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (segment.percent / 100) * circumference}
            strokeLinecap="round"
            style={{
              transform: `rotate(${(segment.offset / 100) * 360}deg)`,
              transformOrigin: 'center',
              transition: 'stroke-dashoffset 0.5s ease',
            }}
          />
        ))}
      </svg>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProgressBar({ 
  value, 
  max, 
  color = 'bg-blue-500',
  showLabel = false,
  size = 'md',
  className 
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  
  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden', heights[size])}>
        <div 
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-slate-500">
          <span>{Math.round(percentage)}%</span>
          <span>{value.toLocaleString()} / {max.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

interface TrendIndicatorProps {
  value: number;
  previousValue: number;
  format?: (val: number) => string;
  className?: string;
}

export function TrendIndicator({ 
  value, 
  previousValue,
  format = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
  className 
}: TrendIndicatorProps) {
  const change = previousValue > 0 
    ? ((value - previousValue) / previousValue) * 100 
    : value > 0 ? 100 : 0;

  const isPositive = change >= 0;
  const isZero = change === 0;

  return (
    <div 
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium',
        isZero ? 'text-slate-500' : isPositive ? 'text-green-600' : 'text-red-600',
        className
      )}
    >
      {!isZero && (
        <svg 
          className={cn('w-4 h-4', !isPositive && 'rotate-180')} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      )}
      <span>{format(change)}</span>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({ 
  data, 
  width = 80, 
  height = 24,
  color = '#b87444',
  className 
}: SparklineProps) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    return data.map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [data, width, height]);

  if (data.length < 2) return null;

  return (
    <svg width={width} height={height} className={className}>
      <path 
        d={path} 
        fill="none" 
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
