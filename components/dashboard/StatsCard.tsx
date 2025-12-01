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
      className="relative overflow-hidden hover-lift animate-in-scale"
      spotlight={true}
      spotlightColor={spotlightColor}
    >
      {/* Icon Background */}
      <div className={`absolute right-0 top-0 size-24 opacity-10 ${color || 'text-primary'}`}>
        <span className="material-symbols-outlined text-[96px]">{icon}</span>
      </div>

      {/* Content */}
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-subtle-light dark:text-subtle-dark mb-1">
              {title}
            </p>
            <h3 className="text-3xl font-bold text-text-light dark:text-text-dark">
              {value}
            </h3>
          </div>
          <div className={`flex size-12 items-center justify-center rounded-lg ${
            color ? `bg-${color}/10` : 'bg-primary/10'
          }`}>
            <span className={`material-symbols-outlined text-2xl ${color || 'text-primary'}`}>
              {icon}
            </span>
          </div>
        </div>

        {/* Trend */}
        {trend && (
          <div className={`mt-3 flex items-center gap-1 text-sm ${
            trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            <span className="material-symbols-outlined text-base">
              {trend.isPositive ? 'trending_up' : 'trending_down'}
            </span>
            <span className="font-medium">{Math.abs(trend.value)}%</span>
            <span className="text-subtle-light dark:text-subtle-dark">bu aydan</span>
          </div>
        )}
      </div>
    </Card>
  );
}
