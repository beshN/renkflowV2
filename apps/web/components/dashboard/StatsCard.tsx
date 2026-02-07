import { StatsCardData } from '@/lib/types';
import { motion, useReducedMotion } from 'framer-motion';
import { memo } from 'react';
import Link from 'next/link';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';

interface StatsCardProps extends Omit<StatsCardData, 'icon'> {
  icon: LucideIcon;
  href?: string;
  className?: string;
}

function StatsCardComponent({ title, value, icon: Icon, trend, color, href, className }: StatsCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const CardContent = (
    <Card className={cn("p-6 flex flex-col justify-between h-full bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 transition-all duration-200 hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700", className)}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{title}</p>
          <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">{value}</h3>
        </div>
        <div className={cn(
          "p-2.5 rounded-lg border shadow-sm",
          color?.includes('primary') ? "bg-primary-50 text-primary-600 border-primary-100 dark:bg-primary-900/10 dark:text-primary-400 dark:border-primary-900/20" :
          color?.includes('blue') ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-900/20" :
          color?.includes('green') ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/20" :
          color?.includes('yellow') ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-900/20" :
          "bg-neutral-50 text-neutral-600 border-neutral-100 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700"
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <div className={cn(
            "flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
            trend.isPositive
              ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
          )}>
            {trend.isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(trend.value)}%
          </div>
          <span className="text-xs text-neutral-400">geçen aya göre</span>
        </div>
      )}
    </Card>
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
