'use client';
import { useState } from 'react';
import { AccountingDashboard,type AccountingTab } from './AccountingDashboard';
export default function AccountingWorkspace(){
  const [period,setPeriod]=useState(new Date().toISOString().slice(0,7));
  const [tab,setTab]=useState<AccountingTab>('overview');
  return <main className="rf-page space-y-5"><div><p className="rf-eyebrow">FİNANSAL KONTROL</p><h1 className="rf-page-title">Muhasebe çalışma alanı</h1><p className="mt-2 text-xs text-muted-foreground">TRY bazında operasyonel mali raporlar; diğer para birimleri Finans ekranında ayrı izlenir.</p><label className="mt-3 flex items-center gap-3 text-xs">Rapor dönemi<input className="rf-input" aria-label="Rapor dönemi" type="month" required value={period} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value))setPeriod(e.target.value);}}/></label></div><nav className="flex flex-wrap gap-2" aria-label="Muhasebe raporları">{([['overview','Genel bakış'],['profit-loss','Gelir ve gider'],['balance-sheet','Bilanço'],['cash-flow','Nakit akışı'],['taxes','Vergi özeti'],['control-tower','Dönem ve banka kontrolü']] as const).map(([id,label])=><button key={id} className={tab===id?'rf-primary-button':'rf-secondary-button'} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav><AccountingDashboard activeTab={tab} period={period}/></main>;
}
