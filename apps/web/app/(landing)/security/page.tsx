import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('security');

export default function Page() {
  return <MarketingStandardPage pageKey="security" />;
}
