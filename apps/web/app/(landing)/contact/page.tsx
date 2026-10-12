import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { ContactChannels } from '@/components/site/ContactChannels';

export const metadata = marketingMetadata('contact');

export default function Page() {
  return (
    <MarketingStandardPage pageKey="contact" hideClosing>
      <ContactChannels />
    </MarketingStandardPage>
  );
}
