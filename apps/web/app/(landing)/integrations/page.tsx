import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('integrations');

export default function Page() {
  return <MarketingStandardPage pageKey="integrations" />;
}
