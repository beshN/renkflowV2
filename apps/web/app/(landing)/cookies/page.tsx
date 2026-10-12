import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('cookies');

export default function Page() {
  return <MarketingStandardPage pageKey="cookies" />;
}
