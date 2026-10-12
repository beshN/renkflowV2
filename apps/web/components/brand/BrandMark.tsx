import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BrandSymbol, BrandWordmark } from './BrandSymbol';
import styles from './BrandMark.module.css';

type BrandMarkProps = {
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
  tone?: 'auto' | 'light';
  className?: string;
};

/** Shared brand lockup with a stable, animated wordmark in the collapsed sidebar. */
export function BrandMark({href='/',size='md',compact=false,tone='auto',className}:BrandMarkProps) {
  return <Link href={href} aria-label="RenkFlow" data-brand="renkflow" data-size={size} data-tone={tone} data-compact={compact} className={cn(styles.brand,className)}>
    <BrandSymbol className={styles.symbol}/>
    <span className={styles.word}><BrandWordmark/></span>
  </Link>;
}
