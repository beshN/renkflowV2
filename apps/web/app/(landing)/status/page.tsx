import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('status');

export default function Page() {
  return <MarketingStandardPage pageKey="status" />;
}
