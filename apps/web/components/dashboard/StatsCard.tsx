import { StatsCardData } from '@/lib/types';
import { motion, useReducedMotion } from 'framer-motion';
import { memo } from 'react';
import Link from 'next/link';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';


interface StatsCardProps extends Omit<StatsCardData, 'icon'> {
  icon: LucideIcon;
  href?: string;
  className?: string;
}

function StatsCardComponent({ title, value, icon: Icon, trend, color, href, className }: StatsCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const CardContent = (
    <div className={cn("group relative flex flex-col justify-between h-full p-6 rounded-2xl border border-white/50 bg-white/40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 dark:border-white/5 dark:bg-white/5", className)}>
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500/90 dark:text-slate-400">{title}</p>
          <h3 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
            {value}
          </h3>
        </div>
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-xl shadow-sm border border-white/40 backdrop-blur-sm transition-transform group-hover:scale-110",
          color?.includes('primary') ? "bg-gradient-to-br from-primary-50 to-white text-primary-600 dark:from-primary-900/20 dark:to-primary-900/5 dark:text-primary-400" :
          color?.includes('blue') ? "bg-gradient-to-br from-blue-50 to-white text-blue-600 dark:from-blue-900/20 dark:to-blue-900/5 dark:text-blue-400" :
          color?.includes('green') ? "bg-gradient-to-br from-emerald-50 to-white text-emerald-600 dark:from-emerald-900/20 dark:to-emerald-900/5 dark:text-emerald-400" :
          color?.includes('yellow') ? "bg-gradient-to-br from-amber-50 to-white text-amber-600 dark:from-amber-900/20 dark:to-amber-900/5 dark:text-amber-400" :
          "bg-gradient-to-br from-slate-50 to-white text-slate-600 dark:from-slate-800 dark:to-slate-900/50 dark:text-slate-400"
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {trend && (
        <div className="flex items-center gap-2 mt-auto">
          <div className={cn(
            "flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-sm",
            trend.isPositive
              ? "bg-emerald-50/80 border-emerald-100/50 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
              : "bg-rose-50/80 border-rose-100/50 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400"
          )}>
            {trend.isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(trend.value)}%
          </div>
          <span className="text-[11px] font-medium text-slate-400/90 dark:text-slate-500">geçen aya göre</span>
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      whileHover={prefersReducedMotion ? {} : { y: -2 }}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      {href ? (
        <Link href={href} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-xl">
          {CardContent}
        </Link>
      ) : (
        CardContent
      )}
    </motion.div>
  );
}

export const StatsCard = memo(StatsCardComponent);
