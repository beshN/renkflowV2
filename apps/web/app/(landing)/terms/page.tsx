import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { LegalDocument } from '@/components/site/LegalDocument';
import { termsDocument } from '@/lib/core/legal-content';

export const metadata = marketingMetadata('terms');

export default function Page() {
  return (
    <MarketingStandardPage pageKey="terms" hideHighlights hideClosing>
      <LegalDocument document={termsDocument} />
    </MarketingStandardPage>
  );
}
