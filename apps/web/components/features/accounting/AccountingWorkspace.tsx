'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/kit/PageHeader';
import { SectionPicker } from '@/components/kit/SectionPicker';
import { AccountingDashboard, type AccountingTab } from './AccountingDashboard';

const REPORTS = [
  { id: 'overview', label: 'Genel bakış' },
  { id: 'profit-loss', label: 'Gelir ve gider' },
  { id: 'cash-flow', label: 'Nakit akışı' },
  { id: 'balance-sheet', label: 'Bilanço' },
  { id: 'taxes', label: 'Vergi özeti' },
  { id: 'ledger', label: 'Yevmiye ve mizan' },
  { id: 'control-tower', label: 'Dönem ve banka işlemleri' },
] as const;

export default function AccountingWorkspace() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [tab, setTab] = useState<AccountingTab>('overview');
  useEffect(() => {
    const read = () => {
      const requested = new URLSearchParams(window.location.search).get('tab');
      setTab(REPORTS.some(report => report.id === requested) ? requested as AccountingTab : 'overview');
    };
    read(); window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  function pick(next: AccountingTab) {
    setTab(next);
    const query = new URLSearchParams(window.location.search);
    query.set('tab', next);
    window.history.pushState(null, '', '/accounting?' + query.toString());
  }
  return <div className="rf-page space-y-5">
    <PageHeader title="Muhasebe" />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-3 text-sm">Rapor dönemi
        <input className="rf-input" type="month" required value={period} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setPeriod(event.target.value); }} />
      </label>
      <p className="text-xs text-muted-foreground">Raporlar Türk lirası cinsindedir. Diğer para birimlerini Finans bölümünden izleyin.</p>
    </div>
    <SectionPicker label="Muhasebe raporları" items={REPORTS} value={tab} onChange={pick} primary={['overview', 'profit-loss', 'cash-flow']} />
    <AccountingDashboard activeTab={tab} period={period} />
  </div>;
}
