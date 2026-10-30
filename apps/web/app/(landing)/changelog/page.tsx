import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { changelog } from '@/lib/core/changelog';
import { ChangelogList } from '@/components/site/v2/pages';

export const metadata = marketingMetadata('changelog');

export default function Page() {
  return (
    <MarketingStandardPage pageKey="changelog" hideHighlights>
      <ChangelogList entries={changelog} />
    </MarketingStandardPage>
  );
}
