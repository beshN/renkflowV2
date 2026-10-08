'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { RFListView, type RFColumn } from '@/components/shared/views/RFListView';
import { listWorkOrders, type WorkOrder } from '@/lib/features/work-orders/client';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, type UserRole } from '@/lib/auth/permissions';
import { formatDate } from '@/lib/utils';
import { WorkshopColor } from '@/components/colors/ColorSwatch';

const statuses: Record<string, string> = {
  open: 'Planlandı', in_progress: 'Üretimde', blocked: 'Bloke', done: 'Tamamlandı', cancelled: 'İptal',
};
const columns: RFColumn<WorkOrder>[] = [
  { key: 'title', label: 'İş emri', render: (value, row) => <div><p className="font-semibold">{value}</p><p className="text-xs text-slate-500">{row.category}</p>{row.color && <WorkshopColor color={row.color} note={false} className="mt-2" />}</div> },
  { key: 'status', label: 'Durum', render: value => <span className="rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{statuses[value] || value}</span> },
  { key: 'assigneeName', label: 'Sorumlu', render: value => value || 'Atanmadı' },
  { key: 'dueAt', label: 'Termin', render: value => value ? formatDate(value) : '—' },
  { key: 'checklistCompleted', label: 'Kontrol listesi', render: (value, row) => row.checklistTotal ? value + ' / ' + row.checklistTotal : '—' },
];

export default function WorkOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await listWorkOrders({ page, pageSize: 25, search: query, status: status ? status as WorkOrder['status'] : undefined });
        if (active) { setData(result.data); setTotal(result.pagination.total); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'İş emirleri yüklenemedi.');
      } finally { if (active) setLoading(false); }
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [query, status, page, revision]);
  const canCreate = user?.role && hasPermission(user.role as UserRole, 'orders.create');
  return (
    <div className="min-h-screen">
      <AppleNavbar title="İş emirleri" showSearch={false} />
      <div className="mx-auto max-w-[1440px] p-4 md:p-6">
        {error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        <button type="button" onClick={() => setRevision(value => value + 1)} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500"><RefreshCw size={14} /> Yenile</button>
        <RFListView title="Atölye iş planı" subtitle="Profil kesimi, işleme, montaj ve kalite kontrol görevleri. Renk karoları ekran yaklaşımıdır; numuneyle teyit edin."
          data={data} columns={columns} isLoading={loading} totalCount={total} page={page} onPageChange={setPage}
          onSearch={value => { setQuery(value); setPage(1); }}
          filters={[{ key: 'status', label: 'Durum', type: 'select', options: Object.entries(statuses).map(([value, label]) => ({ value, label })) }]}
          filterValues={{ status }} onFilterChange={(_, value) => { setStatus(value); setPage(1); }}
          onRowClick={row => router.push('/work-orders/' + row.id)}
          primaryAction={canCreate ? { label: 'Yeni iş emri', icon: <Plus size={16} />, onClick: () => router.push('/work-orders/new') } : undefined}
          emptyState={{ title: 'Henüz iş emri yok', description: 'Atölye görevleri ve siparişe bağlı üretim emirleri burada listelenir.' }} />
      </div>
    </div>
  );
}
