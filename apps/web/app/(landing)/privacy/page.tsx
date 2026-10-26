import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { LegalDocument } from '@/components/site/LegalDocument';
import { privacyDocument } from '@/lib/core/legal-content';

export const metadata = marketingMetadata('privacy');

export default function Page() {
  return (
    <MarketingStandardPage pageKey="privacy" hideHighlights hideClosing>
      <LegalDocument document={privacyDocument} />
    </MarketingStandardPage>
  );
}
