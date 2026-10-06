import { notFound } from 'next/navigation';

import { HighlightGrid, MarketingShell, RelatedLinks } from '@/components/app-core/MarketingShell';
import { marketingPages, type MarketingPageKey } from '@/lib/core/marketing-content';

type MarketingStandardPageProps = {
  pageKey: MarketingPageKey;
};

const SUMMARIES: Record<MarketingPageKey, { title: string; detail: string }> = {
  about: { title: 'Hakkımızda', detail: 'RenkFlow’un neden ve nasıl geliştirildiği.' },
  features: { title: 'Özellikler', detail: 'Siparişten sevkiyata tüm modüller.' },
  pricing: { title: 'Fiyatlandırma', detail: 'Ölçeğinize göre hazırlanan teklif.' },
  integrations: { title: 'Entegrasyonlar', detail: 'API, e-posta, WhatsApp ve barkod.' },
  docs: { title: 'Dokümantasyon', detail: 'Kullanım rehberleri ve API referansı.' },
  security: { title: 'Güvenlik', detail: 'Yetkilendirme, izolasyon ve denetim kaydı.' },
  roadmap: { title: 'Yol haritası', detail: 'Üzerinde çalıştığımız geliştirmeler.' },
  changelog: { title: 'Sürüm notları', detail: 'Yayınlanan güncellemeler.' },
  press: { title: 'Basın', detail: 'Marka dosyaları ve duyurular.' },
  contact: { title: 'İletişim', detail: 'Demo, teklif ve destek talepleri.' },
  faq: { title: 'Sık sorulanlar', detail: 'Kurulum ve kullanım hakkında yanıtlar.' },
  terms: { title: 'Kullanım koşulları', detail: 'Tarafların hak ve sorumlulukları.' },
  privacy: { title: 'Gizlilik', detail: 'Kişisel verilerin işlenmesi ve korunması.' },
  cookies: { title: 'Çerezler', detail: 'Çerez kullanımı ve tercihleriniz.' },
  status: { title: 'Sistem durumu', detail: 'Bakım ve olay duyuruları.' },
};

const RELATED: Record<MarketingPageKey, MarketingPageKey[]> = {
  about: ['features', 'security', 'contact'],
  features: ['integrations', 'security', 'pricing'],
  pricing: ['features', 'faq', 'contact'],
  integrations: ['docs', 'features', 'security'],
  docs: ['integrations', 'changelog', 'faq'],
  security: ['privacy', 'features', 'contact'],
  roadmap: ['changelog', 'features', 'contact'],
  changelog: ['roadmap', 'docs', 'status'],
  press: ['about', 'contact', 'features'],
  contact: ['pricing', 'faq', 'features'],
  faq: ['docs', 'pricing', 'contact'],
  terms: ['privacy', 'cookies', 'security'],
  privacy: ['cookies', 'terms', 'security'],
  cookies: ['privacy', 'terms', 'security'],
  status: ['changelog', 'contact', 'security'],
};

export function MarketingStandardPage({ pageKey }: MarketingStandardPageProps) {
  const page = marketingPages[pageKey];

  if (!page) {
    notFound();
  }

  return (
    <MarketingShell
      badge={page.badge}
      title={page.title}
      description={page.description}
      actions={[
        { href: page.primaryCta.href, label: page.primaryCta.label },
        { href: page.secondaryCta.href, label: page.secondaryCta.label, variant: 'secondary' },
      ]}
    >
      <HighlightGrid items={page.highlights} />
      <RelatedLinks links={RELATED[pageKey].map((key) => ({ href: `/${key}`, ...SUMMARIES[key] }))} />
    </MarketingShell>
  );
}
