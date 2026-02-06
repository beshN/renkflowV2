import { StatsCardData } from '@/lib/types';
import { motion, useReducedMotion } from 'framer-motion';
import { memo } from 'react';
import Link from 'next/link';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Color configuration map for better maintainability
const colorConfig = {
  blue: { base: 'text-blue-500', gradient: 'group-hover:from-blue-500/20', iconBg: 'bg-blue-500/10 text-blue-600' },
  green: { base: 'text-green-500', gradient: 'group-hover:from-green-500/20', iconBg: 'bg-green-500/10 text-green-600' },
  yellow: { base: 'text-yellow-500', gradient: 'group-hover:from-yellow-500/20', iconBg: 'bg-yellow-500/10 text-yellow-600' },
  red: { base: 'text-red-500', gradient: 'group-hover:from-red-500/20', iconBg: 'bg-red-500/10 text-red-600' },
  purple: { base: 'text-purple-500', gradient: 'group-hover:from-purple-500/20', iconBg: 'bg-purple-500/10 text-purple-600' },
  primary: { base: 'text-primary', gradient: 'group-hover:from-primary/20', iconBg: 'bg-primary/10 text-primary' },
  default: { base: 'text-gray-500', gradient: 'group-hover:from-gray-500/20', iconBg: 'bg-gray-500/10' },
} as const;

function getColorConfig(color?: string) {
  if (!color) return colorConfig.default;
  if (color === 'text-primary') return colorConfig.primary;
  
  const colorKey = Object.keys(colorConfig).find(key => color.includes(key));
  return colorKey ? colorConfig[colorKey as keyof typeof colorConfig] : colorConfig.default;
}

// Override type for component prop to be specific
interface StatsCardProps extends Omit<StatsCardData, 'icon'> {
  icon: LucideIcon;
  href?: string;
}

function StatsCardComponent({ title, value, icon: Icon, trend, color, href }: StatsCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const { base: baseColorClass, gradient: gradientFrom, iconBg } = getColorConfig(color);

  const CardContent = (
    <div className={cn(
      "relative overflow-hidden p-6 rounded-2xl glass-panel shadow-premium hover:shadow-glow-primary transition-all duration-300 group cursor-pointer",
      "border-transparent"
    )}>
         {/* Aurora Gradient Hover Effect */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        
        {/* Giant Background Icon */}
        <div className="absolute -right-4 -top-4 opacity-[0.02] group-hover:opacity-[0.06] transition-all duration-500 transform group-hover:scale-110 group-hover:rotate-6 pointer-events-none" aria-hidden="true">
           <Icon className={`w-32 h-32 ${baseColorClass}`} />
        </div>

        <div className="relative flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight font-display" aria-label={`Değer: ${value}`}>{value}</h3>
            
            {/* Trend Indicator */}
            {trend && (
              <div className="flex items-center gap-2 mt-3">
                 <div className={`flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${
                    trend.isPositive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-emerald-600/20'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 ring-rose-600/20'
                 }`}
                 aria-label={`Trend: ${trend.isPositive ? 'yukarı' : 'aşağı'} ${Math.abs(trend.value)}%`}
                 >
                    {/* Trend Icon */}
                    {trend.isPositive ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {Math.abs(trend.value)}%
                 </div>
                 <span className="text-xs text-slate-400 dark:text-slate-500">geçen aya göre</span>
              </div>
            )}
          </div>

          <div className={`p-3 rounded-xl ${iconBg} backdrop-blur-md shadow-sm ring-1 ring-black/5 dark:ring-white/5 bg-white/50`} aria-hidden="true">
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </div>
  );

  return (
    <motion.div
      whileHover={prefersReducedMotion ? {} : { 
        y: -5,
        scale: 1.02
      }}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{ willChange: prefersReducedMotion ? 'auto' : 'transform, opacity' }}
      role="article"
      aria-label={`${title} istatistiği`}
    >
      {href ? (
        <Link href={href} className="block h-full">
          {CardContent}
        </Link>
      ) : (
        CardContent
      )}
    </motion.div>
  );
}

export const StatsCard = memo(StatsCardComponent);
