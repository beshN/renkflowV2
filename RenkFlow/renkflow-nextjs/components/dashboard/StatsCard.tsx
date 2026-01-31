import { StatsCardData } from '@/lib/types';
import { motion } from 'framer-motion';

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

import Link from 'next/link';

export function StatsCard({ title, value, icon, trend, color, href }: StatsCardData & { href?: string }) {
  const { base: baseColorClass, gradient: gradientFrom, iconBg } = getColorConfig(color);

  const CardContent = (
    <div className="relative overflow-hidden p-6 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 group cursor-pointer">
         {/* Aurora Gradient Hover Effect */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        
        {/* Giant Background Icon */}
        <div className="absolute -right-4 -top-4 opacity-[0.02] group-hover:opacity-[0.06] transition-all duration-500 transform group-hover:scale-110 group-hover:rotate-6 pointer-events-none" aria-hidden="true">
           <span className={`material-symbols-outlined text-[100px] ${baseColorClass}`}>
              {icon}
           </span>
        </div>

        <div className="relative flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight" aria-label={`Değer: ${value}`}>{value}</h3>
            
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
                    <span className="material-symbols-outlined text-sm font-bold mr-0.5" aria-hidden="true">
                      {trend.isPositive ? 'trending_up' : 'trending_down'}
                    </span>
                    {Math.abs(trend.value)}%
                 </div>
                 <span className="text-xs text-slate-400 dark:text-slate-500">geçen aya göre</span>
              </div>
            )}
          </div>

          <div className={`p-3 rounded-xl ${iconBg} backdrop-blur-md shadow-sm ring-1 ring-black/5 dark:ring-white/5`} aria-hidden="true">
            <span className="material-symbols-outlined text-2xl">{icon}</span>
          </div>
        </div>
      </div>
  );

  return (
    <motion.div
      whileHover={{ y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
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
