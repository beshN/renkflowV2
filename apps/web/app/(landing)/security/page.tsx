import { MarketingStandardPage, marketingMetadata } from '@/components/app-core/MarketingStandardPage';
import { SectionHead } from '@/components/site/v2/blocks';
import { AuditCard, RoleMatrix } from '@/components/site/v2/pages';

export const metadata = marketingMetadata('security');

export default function Page() {
  return (
    <MarketingStandardPage pageKey="security" aside={<AuditCard />}>
      <div className="mt-24">
        <SectionHead title="Kim neyi görür, neyi değiştirir?">Her temel rolün modüllerdeki izinleri. Bu tablo, sunucunun her istekte uyguladığı kurallardan okunur; bir rol seçin.</SectionHead>
        <div className="mt-10"><RoleMatrix /></div>
      </div>
    </MarketingStandardPage>
  );
}
