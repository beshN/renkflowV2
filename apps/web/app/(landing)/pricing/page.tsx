import { HighlightGrid } from '@/components/app-core/MarketingShell';
import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { SectionHead } from '@/components/site/v2/blocks';
import { ScopeBuilder } from '@/components/site/v2/pages';
import { COMPANY } from '@/lib/core/company';
import { marketingPages } from '@/lib/core/marketing-content';

export const metadata = marketingMetadata('pricing');

export default function Page() {
  return (
    <MarketingStandardPage pageKey="pricing" hideHighlights>
      <SectionHead title="Kapsamı seçin, teklifi biz hazırlayalım.">Modülleri ve kullanıcı sayısını işaretleyin; özet, teklif talebi olarak e-postanıza hazır gelir.</SectionHead>
      <div className="mt-12"><ScopeBuilder email={COMPANY.email} /></div>
      <div className="mt-20"><HighlightGrid items={marketingPages.pricing.highlights} /></div>
    </MarketingStandardPage>
  );
}
