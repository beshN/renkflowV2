'use client';

import { useEffect, useState } from 'react';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { AttendancePolicySettings } from '@/components/settings/AttendancePolicySettings';
import { TenantSettings } from '@/components/settings/TenantSettings';
import { LegalIdentitySettings } from '@/components/settings/LegalIdentitySettings';
import { PrivacyRequests } from '@/components/settings/PrivacyRequests';
import { ProductionSettings } from '@/components/settings/ProductionSettings';
import { ColorCatalogSettings } from '@/components/settings/ColorCatalogSettings';
import { RecordSettings } from '@/components/settings/RecordSettings';
import { QuoteRulesSettings } from '@/components/settings/QuoteRulesSettings';
import { ProductionReasonSettings } from '@/components/settings/ProductionReasonSettings';
import { AssistantPerformance, AssistantSettings } from '@/components/settings/AssistantSettings';
import { useAuth } from '@/lib/context/AuthContext';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'firma', label: 'Firma' },
  { id: 'fatura', label: 'Fatura' },
  { id: 'kvkk', label: 'KVKK' },
  { id: 'uretim', label: 'Üretim ve renkler' },
  { id: 'teklif', label: 'Teklif' },
  { id: 'asistan', label: 'Asistan' },
  { id: 'personel', label: 'Çalışanlar' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** One topic at a time: the firm card first, the rest one tab away (links can open a tab with #asistan). */
export default function SettingsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('firma');
  useEffect(() => {
    const fromUrl = (window.location.hash.slice(1) || new URLSearchParams(window.location.search).get('tab') || '') as Tab;
    if (TABS.some((t) => t.id === fromUrl)) setTab(fromUrl);
  }, []);
  const pick = (t: Tab) => { setTab(t); window.history.replaceState(null, '', `#${t}`); };
  const panel = (children: React.ReactNode) => <div className="rf-panel p-5 md:p-6">{children}</div>;

  return <div className="min-h-screen"><AppleNavbar title="Firma ayarları" showSearch={false} />
    <main className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      {!canManage ? panel(<><h2 className="font-semibold">Firma ayarları</h2><p className="mt-2 text-sm text-muted-foreground">Ayarları yönetici değiştirebilir.</p></>) : <>
        <div role="tablist" aria-label="Ayar bölümleri" className="flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => pick(t.id)}
              className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="space-y-5">
          {tab === 'firma' && panel(<TenantSettings />)}
          {tab === 'fatura' && panel(<LegalIdentitySettings />)}
          {tab === 'kvkk' && panel(<PrivacyRequests />)}
          {tab === 'uretim' && <>{panel(<ProductionSettings />)}{panel(<ColorCatalogSettings />)}{panel(<ProductionReasonSettings />)}</>}
          {tab === 'teklif' && <>{panel(<QuoteRulesSettings />)}{panel(<RecordSettings />)}</>}
          {tab === 'personel' && panel(<AttendancePolicySettings />)}
      {tab === 'asistan' && <>
            <div id="asistan" className="rf-panel p-5 md:p-6"><AssistantSettings /></div>
            <details className="rf-panel p-5 md:p-6"><summary className="cursor-pointer text-sm font-semibold">Asistan performansı</summary><div className="mt-4"><AssistantPerformance /></div></details>
          </>}
        </div>
      </>}
    </main>
  </div>;
}
