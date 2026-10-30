import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { COMPANY, socialLinks, telHref } from '@/lib/core/company';

const SOCIAL_LABELS: Record<string, string> = { instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn' };

const COLUMNS = [
  { title: 'Ürün', links: [['Özellikler', '/features'], ['Entegrasyonlar', '/integrations'], ['Fiyatlandırma', '/pricing'], ['Yol haritası', '/roadmap'], ['Sürüm notları', '/changelog']] },
  { title: 'Şirket', links: [['Hakkımızda', '/about'], ['Basın', '/press'], ['İletişim', '/contact']] },
  { title: 'Kaynaklar', links: [['Dokümantasyon', '/docs'], ['Blog', '/blog'], ['Sık sorulanlar', '/faq'], ['Sistem durumu', '/status']] },
  { title: 'Yasal', links: [['Gizlilik', '/privacy'], ['Kullanım koşulları', '/terms'], ['Çerezler', '/cookies'], ['Güvenlik', '/security']] },
] as const;

/** Site footer on the aluminium canvas; links draw their underline on hover. */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--x-line)] bg-[var(--x-canvas-deep)] text-[var(--x-ink)]">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <BrandMark href="/" />
          <p className="mt-4 text-[13.5px] leading-6 text-[var(--x-muted)]">Pergola ve cam sistemleri için keşiften montaja operasyon yönetimi.</p>
          <p className="mt-5 space-y-1.5 text-[13.5px]">
            <a href={`mailto:${COMPANY.email}`} className="x-link block w-fit">{COMPANY.email}</a>
            {COMPANY.phone && <a href={telHref(COMPANY.phone)} className="x-link x-num block w-fit">{COMPANY.phone}</a>}
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="text-[13px] font-medium">{column.title}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map(([label, href]) => (
                <li key={href}><Link href={href} className="x-link text-[13.5px] text-[var(--x-muted)] hover:text-[var(--x-ink)]">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-[var(--x-line)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[12.5px] text-[var(--x-muted)] sm:px-8">
          <span>© {new Date().getFullYear()} RenkFlow · {COMPANY.shortName}</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {socialLinks().map(({ network, url }) => (
              <a key={network} href={url} target="_blank" rel="noopener noreferrer" className="x-link hover:text-[var(--x-ink)]">{SOCIAL_LABELS[network] ?? network}</a>
            ))}
            <Link href="/status" className="x-link hover:text-[var(--x-ink)]">Sistem durumu</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
