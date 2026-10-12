import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { KvkkNotice } from '@/components/site/KvkkNotice';

export const metadata = marketingMetadata('privacy');

export default function Page() {
  return (
    <MarketingStandardPage pageKey="privacy">
      <KvkkNotice />
    </MarketingStandardPage>
  );
}
