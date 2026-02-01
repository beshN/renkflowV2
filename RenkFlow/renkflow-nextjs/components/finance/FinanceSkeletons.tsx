'use client';

import { cn } from '@/lib/utils';

/**
 * Skeleton Components for Finance Module
 * Professional loading states with smooth animations
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-200 dark:bg-slate-700',
        className
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    </div>
  );
}

export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      {[...Array(columns)].map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {[...Array(columns)].map((_, i) => (
                <th key={i} className="px-6 py-4">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, i) => (
              <TableRowSkeleton key={i} columns={columns} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export function DocumentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmployeeCardSkeleton() {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="w-5 h-5" />
      </div>
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="mt-3">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function EmployeeGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {[...Array(count)].map((_, i) => (
        <EmployeeCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div style={{ height }}>
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    </div>
  );
}

export function FinanceOverviewSkeleton() {
  return (
    <div className="space-y-8">
      <StatsGridSkeleton />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="p-4">
            <CardListSkeleton count={5} />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="p-4">
            <CardListSkeleton count={5} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LedgerEntrySkeleton() {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-6 w-24" />
    </div>
  );
}

export function EmployeeDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <Skeleton className="w-20 h-20 rounded-full mb-4" />
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between">
            <Skeleton className="h-5 w-32" />
            <div className="flex gap-3">
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <LedgerEntrySkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
