'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { RFListView } from '@/components/shared/views/RFListView';
import { useAuth } from '@/lib/context/AuthContext';
import { useApiCollection } from '@/lib/hooks/useApiCollection';
import { Quotation } from '@/lib/features/quotations/types';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { PRICE_MATRIX_READ_ROLES } from '@/lib/features/products/price-matrix';
import { ROUTE_ROLES } from '@/lib/features/auth/permissions';
import { PageHeader } from '@/components/kit';

export default function QuotationsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { data: quotations, loading, error, reload } = useApiCollection<Quotation>('/api/v1/quotations', 'Teklifler alınamadı.');
  const [status,setStatus]=useState('all');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, router, user]);

  if (isLoading || !user) return null;

  const statusMap: Record<string, { label: string; color: 'slate' | 'amber' | 'emerald' | 'rose' | 'sky' | 'indigo' }> = {
    draft: { label: 'Taslak', color: 'slate' },
    sent: { label: 'Gönderildi', color: 'sky' },
    accepted: { label: 'Kabul Edildi', color: 'emerald' },
    rejected: { label: 'Reddedildi', color: 'rose' },
    expired: { label: 'Süresi Doldu', color: 'amber' },
    converted: { label: 'Siparişe Dönüştü', color: 'indigo' },
  };

  return (
    <div className="rf-page space-y-6">
      <PageHeader eyebrow="SATIŞ / TEKLİFLER" title="Teklif yönetimi" hint="Ürün seçimi, fiyatlandırma, müşteri takibi ve siparişe geçiş." action={<Link href="/quotations/new" className="rf-primary-button"><Plus size={15}/> Yeni teklif</Link>} kpis={[
        {label:'teklif',value:quotations.length},
        {label:'taslak',value:quotations.filter(q=>q.status==='draft').length},
        {label:'yanıt bekliyor',value:quotations.filter(q=>q.status==='sent').length,tone:'warning'},
        {label:'kabul edildi',value:quotations.filter(q=>q.status==='accepted').length,tone:'success'},
      ]}/>
      <main className="w-full space-y-4">
        {PRICE_MATRIX_READ_ROLES.includes(user.role) && (
          <div className="mb-4 flex justify-end gap-2">
            {ROUTE_ROLES['/products'].includes(user.role) && <Link href="/products" className="rf-secondary-button">Ürün reçeteleri</Link>}
            <Link href="/quotations/price-matrix" className="rf-secondary-button">Fiyat matrisi</Link>
          </div>
        )}
        <div role="group" aria-label="Teklif durumuna göre filtrele" className="flex flex-wrap gap-2">
          {[['all','Tümü'],...Object.entries(statusMap).map(([key,value])=>[key,value.label])].map(([key,label])=><button type="button" key={key} aria-pressed={status===key} className="min-h-10 rounded-md border border-border px-3 text-xs aria-pressed:border-primary/40 aria-pressed:bg-primary/5 aria-pressed:text-primary" onClick={()=>setStatus(key)}>{label}</button>)}
        </div>
        <RFListView
          hideHeader
          data={status==='all'?quotations:quotations.filter(q=>q.status===status)}
          title="Teklifler"
          description="Müşteri, geçerlilik ve satış aşamasını birlikte takip edin."
          icon={<FileText className="h-5 w-5 text-sky-500" />}
          isLoading={loading}
          error={error || null}
          onRetry={reload}
          columns={[
            { key: 'quotationNumber', label: 'Teklif No' },
            { key: 'customerName', label: 'Müşteri' },
            { 
              key: 'status', 
              label: 'Durum',
              render: (_status, q) => (
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                  statusMap[q.status]?.color === 'slate' ? 'bg-slate-50 text-slate-700 ring-slate-600/20' :
                  statusMap[q.status]?.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                  statusMap[q.status]?.color === 'rose' ? 'bg-rose-50 text-rose-700 ring-rose-600/20' :
                  statusMap[q.status]?.color === 'amber' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                  statusMap[q.status]?.color === 'sky' ? 'bg-sky-50 text-sky-700 ring-sky-600/20' :
                  'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
                }`}>
                  {statusMap[q.status]?.label || q.status}
                </span>
              )
            },
            { 
              key: 'totalAmount', 
              label: 'Toplam Tutar',
              render: (_amount, q) => formatCurrency(q.totalAmount, q.currency)
            },
            {
              key: 'validUntil',
              label: 'Geçerlilik',
              render: (_validUntil, q) => q.validUntil ? new Date(q.validUntil).toLocaleDateString('tr-TR') : '-'
            }
          ]}
          searchKeys={['quotationNumber', 'customerName']}
          onRowClick={(q) => router.push(`/quotations/${q.id}`)}
        />
      </main>
    </div>
  );
}
