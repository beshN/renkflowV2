import { cn } from '@/lib/utils';

/** Placeholder shapes while data arrives: no "Yükleniyor" text anywhere. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)} />;
}
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Veriler alınıyor">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}
