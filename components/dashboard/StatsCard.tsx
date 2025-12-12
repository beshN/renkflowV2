import { StatsCardData } from '@/lib/types';
import { Card } from '../ui/Card';

export function StatsCard({ title, value, icon, trend, color }: StatsCardData) {
  // Map text colors to spotlight colors
  let spotlightColor = 'rgba(255, 255, 255, 0.15)';
  if (color?.includes('blue')) spotlightColor = 'rgba(59, 130, 246, 0.15)';
  if (color?.includes('green')) spotlightColor = 'rgba(16, 185, 129, 0.15)';
  if (color?.includes('yellow')) spotlightColor = 'rgba(234, 179, 8, 0.15)';
  if (color?.includes('red')) spotlightColor = 'rgba(239, 68, 68, 0.15)';

  return (
    <Card 
      className="relative overflow-hidden hover-lift animate-in-scale p-4 md:p-6"
      spotlight={true}
      spotlightColor={spotlightColor}
    >
      {/* Icon Background - hidden on small mobile */}
      <div className={`absolute right-0 top-0 size-16 md:size-24 opacity-10 ${color || 'text-primary'} hidden sm:block`}>
        <span className="material-symbols-outlined text-[64px] md:text-[96px]">{icon}</span>
      </div>

      {/* Content */}
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm text-subtle-light dark:text-subtle-dark mb-0.5 md:mb-1 truncate">
              {title}
            </p>
            <h3 className="text-xl md:text-3xl font-bold text-text-light dark:text-text-dark truncate">
              {value}
            </h3>
          </div>
          <div className={`flex size-9 md:size-12 items-center justify-center rounded-lg flex-shrink-0 ${
            color ? `bg-${color}/10` : 'bg-primary/10'
          }`}>
            <span className={`material-symbols-outlined text-lg md:text-2xl ${color || 'text-primary'}`}>
              {icon}
            </span>
          </div>
        </div>

        {/* Trend */}
        {trend && (
          <div className={`mt-2 md:mt-3 flex items-center gap-1 text-xs md:text-sm ${
            trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            <span className="material-symbols-outlined text-sm md:text-base">
              {trend.isPositive ? 'trending_up' : 'trending_down'}
            </span>
            <span className="font-medium">{Math.abs(trend.value)}%</span>
            <span className="text-subtle-light dark:text-subtle-dark hidden sm:inline">bu aydan</span>
          </div>
        )}
      </div>
    </Card>
  );
}
