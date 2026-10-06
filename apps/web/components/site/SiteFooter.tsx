import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';

const COLUMNS = [
  { title: 'Ürün', links: [['Özellikler', '/features'], ['Entegrasyonlar', '/integrations'], ['Fiyatlandırma', '/pricing'], ['Yol haritası', '/roadmap'], ['Sürüm notları', '/changelog']] },
  { title: 'Şirket', links: [['Hakkımızda', '/about'], ['Kariyer', '/careers'], ['Basın', '/press'], ['İletişim', '/contact']] },
  { title: 'Kaynaklar', links: [['Dokümantasyon', '/docs'], ['Blog', '/blog'], ['Sık sorulanlar', '/faq'], ['Sistem durumu', '/status']] },
  { title: 'Yasal', links: [['Gizlilik', '/privacy'], ['Kullanım koşulları', '/terms'], ['Çerezler', '/cookies'], ['Güvenlik', '/security']] },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <BrandMark href="/" />
          <p className="mt-4 text-[13px] leading-6 text-muted-foreground">Alüminyum üreticileri için sipariş, üretim, depo ve sevkiyat yönetimi.</p>
          <a href="mailto:info@renkflow.com" className="mt-4 inline-block text-[13px] text-foreground underline-offset-4 hover:underline">info@renkflow.com</a>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-[13px] font-medium">{column.title}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map(([label, href]) => (
                <li key={href}><Link href={href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[12px] text-muted-foreground sm:px-8">
          <span>© {new Date().getFullYear()} RenkFlow · Renk Alüminyum</span>
          <Link href="/status" className="inline-flex items-center gap-2 hover:text-foreground">Sistem durumu</Link>
        </div>
      </div>
    </footer>
  );
}
