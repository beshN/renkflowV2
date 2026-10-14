'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/kit/PageHeader';
import { SectionPicker } from '@/components/kit/SectionPicker';
import { TaskDisclosure } from '@/components/kit/TaskDisclosure';
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

const TABS = [
  { id: 'firma', label: 'Firma' },
  { id: 'fatura', label: 'Fatura' },
  { id: 'kvkk', label: 'KVKK' },
  { id: 'uretim', label: 'Üretim ve renkler' },
  { id: 'teklif', label: 'Teklif' },
  { id: 'asistan', label: 'Asistan' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** One topic at a time: the firm card first, the rest one tab away (links can open a tab with #asistan). */
export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const canManage = user?.role === 'owner' || user?.role === 'admin';
  const [tab, setTab] = useState<Tab>('firma');
  useEffect(() => {
    const read = () => {
      const fromUrl = (window.location.hash.slice(1) || new URLSearchParams(window.location.search).get('tab') || 'firma') as Tab;
      if (TABS.some(t => t.id === fromUrl)) setTab(fromUrl);
    };
    read(); window.addEventListener('popstate', read); window.addEventListener('hashchange', read);
    return () => { window.removeEventListener('popstate', read); window.removeEventListener('hashchange', read); };
  }, []);
  const pick = (t: Tab) => { setTab(t); window.history.pushState(null, '', `#${t}`); };
  const panel = (children: React.ReactNode) => <div className="rf-panel p-5 md:p-6">{children}</div>;

  return <div className="rf-page mx-auto max-w-4xl space-y-5">
      <PageHeader title="Ayarlar" />
      {isLoading ? <p role="status" className="text-sm text-muted-foreground">Ayarlar alınıyor…</p> : !canManage ? panel(<><h2 className="font-semibold">Firma ayarları</h2><p className="mt-2 text-sm text-muted-foreground">Ayarları yönetici değiştirebilir.</p></>) : <>
        <SectionPicker label="Ayar bölümleri" items={TABS} value={tab} onChange={pick} primary={['firma', 'fatura', 'uretim']} />
        <div className="space-y-5">
          {tab === 'firma' && panel(<TenantSettings />)}
          {tab === 'fatura' && panel(<LegalIdentitySettings />)}
          {tab === 'kvkk' && panel(<PrivacyRequests />)}
          {tab === 'uretim' && <>
            <TaskDisclosure group="production-settings" title="Üretim kuralları"><ProductionSettings /></TaskDisclosure>
            <TaskDisclosure group="production-settings" title="Renkler"><ColorCatalogSettings /></TaskDisclosure>
            <TaskDisclosure group="production-settings" title="Duruş ve hata nedenleri"><ProductionReasonSettings /></TaskDisclosure>
          </>}
          {tab === 'teklif' && <>
            <TaskDisclosure group="quote-settings" title="Teklif ve fiyat kuralları"><QuoteRulesSettings /></TaskDisclosure>
            <TaskDisclosure group="quote-settings" title="Belge ve kayıt ayarları"><RecordSettings /></TaskDisclosure>
          </>}
          {tab === 'asistan' && <>
            <div id="asistan" className="rf-panel p-5 md:p-6"><AssistantSettings /></div>
            <details className="rf-panel p-5 md:p-6"><summary className="cursor-pointer text-sm font-semibold">Asistan performansı</summary><div className="mt-4"><AssistantPerformance /></div></details>
          </>}
        </div>
      </>}
  </div>;
}
