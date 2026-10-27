import { fairHosts, fairTenantId, FAIR_PAGE } from '@/lib/features/fair/config';
import { FairRequestsWorkspace } from '@/components/features/fair/FairRequestsWorkspace';

export const dynamic = 'force-dynamic';

export default function FairRequestsPage() {
  const [host] = [...fairHosts()];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const fairUrl = host ? `https://${host}` : appUrl ? `${appUrl}${FAIR_PAGE}` : '';
  return <div className="rf-page space-y-5"><FairRequestsWorkspace enabled={Boolean(fairTenantId())} fairUrl={fairUrl} /></div>;
}
