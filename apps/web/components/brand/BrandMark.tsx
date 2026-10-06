import Link from 'next/link';
import { cn } from '@/lib/utils';

type BrandMarkProps = {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the wordmark, e.g. in a collapsed sidebar. */
  compact?: boolean;
  /** Invert for permanently dark surfaces such as the auth showcase. */
  tone?: 'auto' | 'light';
  className?: string;
};

const SIZES = { sm: 'h-6 w-6', md: 'h-7 w-7', lg: 'h-8 w-8' };

/** The single RenkFlow logo used by landing, auth and workspace chrome. */
export function BrandMark({ href = '/', size = 'md', compact = false, tone = 'auto', className }: BrandMarkProps) {
  return (
    <Link href={href} aria-label="RenkFlow" className={cn('inline-flex min-w-0 items-center gap-2.5', tone === 'light' && 'rf-on-dark', className)}>
      <span className={cn('rf-logo', SIZES[size])} aria-hidden>
        <svg viewBox="0 0 24 24" className="h-[56%] w-[56%]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 19V5h5.5a4.25 4.25 0 0 1 0 8.5H7" />
          <path d="m12.5 13.5 4.5 5.5" />
        </svg>
      </span>
      {!compact && (
        <span className={cn('whitespace-nowrap text-[15px] font-semibold tracking-[-0.03em]', tone === 'light' ? 'text-white' : 'text-foreground')}>
          RenkFlow
        </span>
      )}
    </Link>
  );
}
