'use client';

import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { TenantSettings } from '@/components/settings/TenantSettings';
import { ProductionSettings } from '@/components/settings/ProductionSettings';
import { useAuth } from '@/lib/context/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'admin';
  return <div className="min-h-screen"><AppleNavbar title="Firma ayarları" showSearch={false} />
    <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      {canManage ? <div className="rf-panel p-5 md:p-6"><TenantSettings /></div> : <div className="rf-panel p-5"><h2 className="font-semibold">Renk Alüminyum</h2><p className="mt-2 text-sm text-slate-500">Firma ayarlarını yönetici düzenleyebilir.</p></div>}
      {canManage && <div className="rf-panel p-5 md:p-6"><ProductionSettings /></div>}
    </main>
  </div>;
}
