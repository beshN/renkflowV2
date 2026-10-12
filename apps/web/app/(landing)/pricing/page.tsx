import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('pricing');

export default function Page() {
  return <MarketingStandardPage pageKey="pricing" />;
}
