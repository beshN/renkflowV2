import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('faq');

export default function Page() {
  return <MarketingStandardPage pageKey="faq" />;
}
