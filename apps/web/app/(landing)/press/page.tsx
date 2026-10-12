import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('press');

export default function Page() {
  return <MarketingStandardPage pageKey="press" />;
}
