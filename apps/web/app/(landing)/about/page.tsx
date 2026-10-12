import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('about');

export default function Page() {
  return <MarketingStandardPage pageKey="about" />;
}
