import { configuratorBaseUrl, fairTenantId } from '@/lib/features/fair/config';
import { ConfiguratorAdmin } from '@/components/features/fair/ConfiguratorAdmin';

export const dynamic = 'force-dynamic';

export default function ConfiguratorAdminPage() {
  return <div className="rf-page space-y-5"><ConfiguratorAdmin enabled={Boolean(fairTenantId())} publicBase={configuratorBaseUrl()} /></div>;
}
