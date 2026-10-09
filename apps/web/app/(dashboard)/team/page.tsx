'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { RFListView } from '@/components/shared/views/RFListView';
import { listTenantMembers, type TenantMember } from '@/lib/features/work-orders/client';
import { useAuth } from '@/lib/context/AuthContext';
import { TeamWorkspace } from '@/components/team/TeamWorkspace';

const roles: Record<string, string> = { owner: 'Firma sahibi', admin: 'Yönetici', office: 'Ofis', worker: 'Atölye', member: 'Ekip üyesi', accountant: 'Muhasebe' };
export default function TeamPage() {
  const { user } = useAuth();
  const manager = user?.role === 'owner' || user?.role === 'admin';
  if (manager) return <div className="rf-page space-y-5"><TeamWorkspace /></div>;
  return <TeamList />;
}

/** Everyone else sees who is on the team and their role. */
function TeamList() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    listTenantMembers().then(data => { if (active) setMembers(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className="min-h-screen"><AppleNavbar title="Renk Alüminyum ekibi" showSearch={false} />
    <main className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {(user?.role === 'owner' || user?.role === 'admin') && <Link href="/settings" className="inline-block text-sm text-blue-600">Firma ayarlarından ekip arkadaşı davet et →</Link>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <RFListView title="Ekip ve yetkiler" data={members} isLoading={loading} columns={[
        { key: 'name', label: 'Ad soyad' }, { key: 'email', label: 'E-posta' }, { key: 'role', label: 'Rol', render: value => roles[value] || value },
      ]} />
    </main>
  </div>;
}
