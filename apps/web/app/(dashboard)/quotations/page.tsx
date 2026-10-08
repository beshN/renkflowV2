'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { RFListView } from '@/components/shared/views/RFListView';
import { useAuth } from '@/lib/context/AuthContext';
import { useApiCollection } from '@/lib/hooks/useApiCollection';
import { Quotation } from '@/lib/features/quotations/types';
import { formatCurrency } from '@/lib/utils';
import { Navbar } from '@/components/layout/Navbar';
import Link from 'next/link';

export default function QuotationsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { data: quotations, loading, error, reload } = useApiCollection<Quotation>('/api/v1/quotations', 'Teklifler alınamadı.');

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
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title="Teklifler" />
      
      <main className="w-full flex-1 p-4 md:p-8">
        {['owner', 'admin', 'office', 'accountant'].includes(user.role) && (
          <div className="mb-4 flex justify-end"><Link href="/quotations/price-matrix" className="rf-secondary-button">Fiyat matrisi</Link></div>
        )}
        <RFListView
          data={quotations}
          title="Teklif Listesi"
          description="Tüm teklifleri görüntüleyin ve yönetin."
          icon={<FileText className="h-5 w-5 text-sky-500" />}
          primaryAction={{
            label: "Yeni Teklif",
            icon: <Plus className="h-4 w-4" />,
            onClick: () => router.push('/quotations/new'),
          }}
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
