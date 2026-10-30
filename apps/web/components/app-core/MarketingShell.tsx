import Link from 'next/link';
import type { ReactNode } from 'react';
import { ClosingBand, FactList, RelatedLinks as Related } from '@/components/site/v2/blocks';

type ShellAction = {
  href: string;
  label: string;
  variant?: 'primary' | 'secondary';
};

type MarketingShellProps = {
  badge?: string;
  title: string;
  description: string;
  actions?: ShellAction[];
  /** @deprecated Kept for call-site compatibility; no longer rendered. */
  spotlight?: Array<{ label: string; value: string }>;
  /** A product piece shown beside the title on wide screens. */
  aside?: ReactNode;
  children?: ReactNode;
  /** Hide the closing call-to-action band (e.g. on the contact page itself). */
  hideClosing?: boolean;
};

/**
 * Shared frame for every public content page: an anthracite head with the page title (visible in
 * the first paint, it only settles), the body on the aluminium canvas, and the closing band.
 */
export function MarketingShell({ badge, title, description, actions = [], aside, children, hideClosing = false }: MarketingShellProps) {
  return (
    <>
      <section className="x-cone relative overflow-hidden text-[var(--x-chrome-fg)]">
        <div className={`relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 sm:px-8 md:pb-20 md:pt-20 ${aside ? 'lg:grid-cols-[1.05fr_0.95fr] lg:items-center' : ''}`}>
          <div>
            {badge ? (
              <nav aria-label="Konum" className="x-rise flex items-center gap-2 text-[13px] text-[var(--x-chrome-muted)]">
                <Link href="/" className="x-link hover:text-[var(--x-chrome-fg)]">RenkFlow</Link>
                <span aria-hidden className="text-white/25">/</span>
                <span aria-current="page" className="text-[var(--x-chrome-fg)]">{badge}</span>
              </nav>
            ) : null}
            <h1 className={`x-display x-rise x-rise-2 mt-5 max-w-[20ch] leading-[1.04] [text-wrap:balance] ${aside ? 'text-[clamp(32px,3.6vw,46px)]' : 'text-[clamp(34px,4.6vw,56px)]'}`}>{title}</h1>
            <p className="x-rise x-rise-3 mt-5 max-w-[60ch] text-[16px] leading-[1.7] text-[var(--x-chrome-muted)]">{description}</p>
            {actions.length > 0 ? (
              <div className="x-rise x-rise-4 mt-8 flex flex-wrap items-center gap-3">
                {actions.map((action) => (
                  <Link key={`${action.href}-${action.label}`} href={action.href} className={`x-btn ${action.variant === 'secondary' ? 'x-btn-ghost-dark' : 'x-btn-primary'}`}>{action.label}</Link>
                ))}
              </div>
            ) : null}
          </div>
          {aside ? <div className="x-rise x-rise-4 text-[var(--x-ink)]">{aside}</div> : null}
        </div>
      </section>

      {children ? <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-24">{children}</div> : null}

      {!hideClosing && <ClosingBand />}
    </>
  );
}

type Highlight = { title: string; detail: string };

/** The page's main points as term and detail rows. */
export function HighlightGrid({ items }: { items: readonly Highlight[] }) {
  return <FactList items={items} />;
}

type RelatedLink = { href: string; title: string; detail: string };

/** "Keep reading" links that tie the public pages together. */
export function RelatedLinks({ links }: { links: readonly RelatedLink[] }) {
  return <Related links={links} />;
}
