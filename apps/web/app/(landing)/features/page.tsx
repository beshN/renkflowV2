import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { SectionHead } from '@/components/site/v2/blocks';
import { FeatureExplorer } from '@/components/site/v2/pages';
import { marketingPages } from '@/lib/core/marketing-content';

export const metadata = marketingMetadata('features');

export default function Page() {
  return (
    <MarketingStandardPage pageKey="features" hideHighlights>
      <SectionHead title="Altı modül, tek kayıt.">Bir modül seçin; o modülün ekranından bir kesit, ana sayfadaki örnek siparişlerle hesaplanmış olarak açılır.</SectionHead>
      <div className="mt-12"><FeatureExplorer items={marketingPages.features.highlights} /></div>
    </MarketingStandardPage>
  );
}
