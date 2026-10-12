import { BrandSymbol } from './BrandSymbol';
import { cn } from '@/lib/utils';

type CutLoaderProps = {
  /** `page` fills the viewport, `area` fills its container, `inline` is just the bar. */
  variant?: 'page' | 'area' | 'inline';
  label?: string;
  className?: string;
};

/**
 * Loading indicator: a saw line sweeps a profile bar and the pieces part, then close
 * again. Pure CSS so it works in server `loading.tsx` files; static under reduced motion.
 */
export function CutLoader({ variant = 'area', label = 'Sayfa açılıyor', className }: CutLoaderProps) {
  const bar = (
    <div className={cn('flex flex-col items-center gap-4', variant === 'inline' && 'gap-2')} role="status" aria-live="polite">
      {variant !== 'inline' && <BrandSymbol className="h-9 w-10 text-foreground" />}
      <div className={variant === 'inline' ? 'w-24' : 'w-44'}>
        <div className="rf-cutload" aria-hidden>
          <span className="rf-cutload-seg" /><span className="rf-cutload-seg" /><span className="rf-cutload-seg" />
          <span className="rf-cutload-saw" />
        </div>
      </div>
      <p className="sr-only">{label}</p>
    </div>
  );
  if (variant === 'inline') return <div className={cn('flex justify-center py-4', className)}>{bar}</div>;
  return (
    <div className={cn('flex w-full items-center justify-center', variant === 'page' ? 'rf-app-shell min-h-screen bg-background' : 'min-h-[40vh]', className)}>
      {bar}
    </div>
  );
}
