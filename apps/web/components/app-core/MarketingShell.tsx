import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';

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
  children?: ReactNode;
  /** Hide the closing call-to-action band (e.g. on the contact page itself). */
  hideClosing?: boolean;
};

function ActionLink({ action }: { action: ShellAction }) {
  const className =
    action.variant === 'secondary'
      ? 'rf-secondary-button h-10 px-4 text-[13.5px]'
      : 'rf-ink-button group h-10 px-4 text-[13.5px]';
  return (
    <Link href={action.href} className={className}>
      {action.label}
      {action.variant !== 'secondary' && <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />}
    </Link>
  );
}

/** Shared frame for every public content page: hero, body and a closing CTA. */
export function MarketingShell({ badge, title, description, actions = [], children, hideClosing = false }: MarketingShellProps) {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-background to-muted/40">
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 sm:px-8 md:pb-20 md:pt-28">
          <Reveal y={8}>
            {badge ? <p className="rf-chip">{badge}</p> : null}
            <h1 className="mt-6 max-w-3xl text-[clamp(34px,5vw,56px)] font-semibold leading-[1.04] tracking-[-0.045em]">{title}</h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-8 text-muted-foreground">{description}</p>
            {actions.length > 0 ? (
              <div className="mt-9 flex flex-wrap items-center gap-3">
                {actions.map((action) => <ActionLink key={`${action.href}-${action.label}`} action={action} />)}
              </div>
            ) : null}
          </Reveal>
        </div>
      </section>

      {children ? <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-24">{children}</div> : null}

      {!hideClosing && (
        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-8 rounded-2xl border border-border bg-muted/50 px-8 py-12 md:px-14 md:py-14">
              <div className="max-w-xl">
                <h2 className="text-[clamp(24px,2.8vw,34px)] font-semibold leading-tight tracking-[-0.035em]">RenkFlow’u kendi projelerinizle görün.</h2>
                <p className="mt-3 text-[15px] leading-7 text-muted-foreground">30 dakikalık bir görüşmede ekibinizin iş akışını birlikte kurgulayalım.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/contact" className="rf-ink-button group h-10 px-4 text-[13.5px]">Demo talep edin <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></Link>
                <Link href="/auth/login" className="rf-secondary-button h-10 px-4 text-[13.5px]">Giriş yap</Link>
              </div>
            </div>
          </Reveal>
        </section>
      )}
    </>
  );
}

type Highlight = { title: string; detail: string };

/** Numbered feature grid with hairline dividers. */
export function HighlightGrid({ items }: { items: readonly Highlight[] }) {
  return (
    <Stagger className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <StaggerItem key={item.title} className="h-full">
          <article className="h-full bg-card p-7">
            <p className="font-mono text-[12px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</p>
            <h2 className="mt-6 text-[17px] font-semibold tracking-[-0.02em]">{item.title}</h2>
            <p className="mt-2.5 text-[14px] leading-6 text-muted-foreground">{item.detail}</p>
          </article>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

type RelatedLink = { href: string; title: string; detail: string };

/** "Keep reading" links that tie the public pages together. */
export function RelatedLinks({ links }: { links: readonly RelatedLink[] }) {
  return (
    <div className="mt-20">
      <Reveal><h2 className="text-[13px] font-medium text-muted-foreground">İlgili sayfalar</h2></Reveal>
      <Stagger className="mt-5 grid gap-3 md:grid-cols-3">
        {links.map((link) => (
          <StaggerItem key={link.href}>
            <Link href={link.href} className="group flex h-full flex-col justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20">
              <div>
                <p className="flex items-center justify-between text-[15px] font-medium">{link.title}<ArrowUpRight size={16} className="text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" /></p>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{link.detail}</p>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
