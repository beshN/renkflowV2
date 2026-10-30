import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { ApiSample } from '@/components/site/v2/pages';

export const metadata = marketingMetadata('integrations');

export default function Page() {
  return <MarketingStandardPage pageKey="integrations" aside={<ApiSample />} />;
}
