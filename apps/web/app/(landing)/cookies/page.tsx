import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { CookiePreferencesButton } from '@/components/site/CookiePreferencesButton';
import { LegalDocument } from '@/components/site/LegalDocument';
import { cookieDocument } from '@/lib/core/legal-content';

export const metadata = marketingMetadata('cookies');

export default function Page() {
  return (
    <MarketingStandardPage pageKey="cookies" hideHighlights hideClosing>
      <LegalDocument document={cookieDocument}>
        <CookiePreferencesButton />
      </LegalDocument>
    </MarketingStandardPage>
  );
}
