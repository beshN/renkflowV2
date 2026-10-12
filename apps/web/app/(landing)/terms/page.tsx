import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('terms');

export default function Page() {
  return <MarketingStandardPage pageKey="terms" />;
}
