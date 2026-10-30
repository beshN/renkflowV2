import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { DrawingSheet } from '@/components/site/v2/pages';

export const metadata = marketingMetadata('about');

export default function Page() {
  return <MarketingStandardPage pageKey="about" aside={<DrawingSheet />} />;
}
