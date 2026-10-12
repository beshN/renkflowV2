import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('roadmap');

export default function Page() {
  return <MarketingStandardPage pageKey="roadmap" />;
}
