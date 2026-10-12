import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('features');

export default function Page() {
  return <MarketingStandardPage pageKey="features" />;
}
