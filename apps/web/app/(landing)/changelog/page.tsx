import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('changelog');

export default function Page() {
  return <MarketingStandardPage pageKey="changelog" />;
}
