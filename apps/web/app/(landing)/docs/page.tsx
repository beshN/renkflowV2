import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';

export const metadata = marketingMetadata('docs');

export default function Page() {
  return <MarketingStandardPage pageKey="docs" />;
}
