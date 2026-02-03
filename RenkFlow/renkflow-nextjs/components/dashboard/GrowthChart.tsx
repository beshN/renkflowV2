'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface DataPoint {
  year: string;
  value: number;
}

interface GrowthChartProps {
  data: DataPoint[];
  className?: string;
}

export function GrowthChart({ data, className }: GrowthChartProps) {
  const [period, setPeriod] = useState<'yearly' | 'monthly' | 'weekly'>('yearly');
  
  const maxValue = Math.max(...data.map(d => d.value));
  const yAxisLabels = ['100k', '50k', '20k', '10k', '0'];

  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 min-h-[200px] min-w-[320px]",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <h3 className="text-xl font-semibold text-gray-900 tracking-tight">Büyüme</h3>
        <button 
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span>{period === 'yearly' ? 'Yıllık' : period === 'monthly' ? 'Aylık' : 'Haftalık'}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Chart */}
      <div className="relative flex gap-4">
        {/* Y-Axis Labels */}
        <div className="flex flex-col justify-between h-[137px] text-[10px] font-medium text-gray-400 tracking-tight">
          {yAxisLabels.map((label) => (
            <span key={label} className="h-[15px] flex items-center">{label}</span>
          ))}
        </div>

        {/* Chart Area */}
        <div className="flex-1 relative">
          {/* Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {yAxisLabels.map((_, i) => (
              <div key={i} className="w-full h-px bg-gray-100" />
            ))}
          </div>

          {/* Area Chart */}
          <svg 
            className="absolute inset-0 w-full h-[137px]" 
            viewBox="0 0 400 137" 
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#25CD25" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#25CD25" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Area */}
            <path
              d={`
                M 0 ${137 - (data[0]?.value / maxValue) * 120}
                ${data.map((point, i) => {
                  const x = (i / (data.length - 1)) * 400;
                  const y = 137 - (point.value / maxValue) * 120;
                  return `L ${x} ${y}`;
                }).join(' ')}
                L 400 137
                L 0 137
                Z
              `}
              fill="url(#growthGradient)"
            />
            
            {/* Line */}
            <path
              d={`
                M 0 ${137 - (data[0]?.value / maxValue) * 120}
                ${data.map((point, i) => {
                  const x = (i / (data.length - 1)) * 400;
                  const y = 137 - (point.value / maxValue) * 120;
                  return `L ${x} ${y}`;
                }).join(' ')}
              `}
              fill="none"
              stroke="#25CD25"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          </svg>

          {/* X-Axis Labels */}
          <div className="absolute -bottom-8 left-0 right-0 flex justify-between">
            {data.map((point) => (
              <div 
                key={point.year} 
                className="text-[10px] font-medium text-gray-400 text-center"
              >
                {point.year}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TopStatesProps {
  states: { code: string; value: number }[];
  className?: string;
}

export function TopStates({ states, className }: TopStatesProps) {
  const maxValue = Math.max(...states.map(s => s.value));

  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 min-w-[320px] flex flex-col",
      className
    )}>
      {/* Header */}
      <div className="pb-4">
        <h3 className="text-xl font-semibold text-gray-900 tracking-tight">En İyi Bölgeler</h3>
      </div>

      {/* Bars */}
      <div className="space-y-2">
        {states.map((state) => {
          const percentage = (state.value / maxValue) * 100;
          return (
            <div
              key={state.code}
              className="relative py-1.5 px-2 rounded"
              style={{
                background: `linear-gradient(to right, #FFCD71 0%, rgba(255, 205, 113, 0) ${percentage}%)`,
                width: `${percentage}%`,
                minWidth: '80px',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900 uppercase">
                  {state.code}
                </span>
                <span className="text-[10px] font-medium text-gray-900">
                  {state.value >= 1000 ? `${state.value / 1000}k` : state.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface NewDealsProps {
  deals: { id: string; name: string }[];
  className?: string;
}

export function NewDeals({ deals, className }: NewDealsProps) {
  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 min-w-[320px] flex-1 flex flex-col",
      className
    )}>
      {/* Header */}
      <div className="pb-4">
        <h3 className="text-xl font-semibold text-gray-900 tracking-tight">Yeni Anlaşmalar</h3>
      </div>

      {/* Deal Tags */}
      <div className="flex flex-wrap gap-2">
        {deals.map((deal) => (
          <div 
            key={deal.id}
            className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-3 rounded-2xl"
          >
            <svg 
              className="w-5 h-5 text-orange-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
              />
            </svg>
            <span className="text-sm font-normal">{deal.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
