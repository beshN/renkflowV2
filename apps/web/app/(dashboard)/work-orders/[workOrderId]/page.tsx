'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { getWorkOrderDetails, toggleWorkOrderChecklistItem, type WorkOrderDetails } from '@/lib/features/work-orders/client';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, type UserRole } from '@/lib/auth/permissions';
import { WorkshopColor } from '@/components/colors/ColorSwatch';
import { RecordButton } from '@/components/records/RecordDrawer';
import { SkeletonRows } from '@/components/kit';

const statuses: Record<string, string> = { open: 'Planlandı', in_progress: 'Üretimde', blocked: 'Bloke', done: 'Tamamlandı', cancelled: 'İptal' };
export default function WorkOrderDetail({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = use(params);
  const { user } = useAuth();
  const [data, setData] = useState<WorkOrderDetails | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getWorkOrderDetails(workOrderId).then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'İş emri yüklenemedi.'); });
    return () => { active = false; };
  }, [workOrderId]);
  async function toggle(id: string, completed: boolean) {
    setBusy(id); setError('');
    try {
      await toggleWorkOrderChecklistItem(workOrderId, id, completed);
      setData(await getWorkOrderDetails(workOrderId));
    } catch (err) { setError(err instanceof Error ? err.message : 'Kontrol kaydedilemedi.'); }
    finally { setBusy(null); }
  }
  return (
    <div className="min-h-screen">
      <AppleNavbar title="İş emri detayı" showSearch={false} />
      <main className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
        <Link href="/work-orders" className="text-sm text-blue-600">← İş emirlerine dön</Link>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {!data && !error && <SkeletonRows rows={5} />}
        {data && <>
          <section className="rf-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{data.category} · {statuses[data.status]}</p>
            <h2 className="mt-2 flex items-center justify-between gap-2 text-xl font-semibold">{data.title}<RecordButton type="work_order" id={data.id} compact /></h2>
            {data.color && <WorkshopColor color={data.color} size="lg" className="mt-4 rounded-md border border-border p-3" />}
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-500">{data.description || 'Açıklama eklenmedi.'}</p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
              <div><dt className="text-slate-500">Sorumlu</dt><dd className="mt-1 font-medium">{data.assigneeName || 'Atanmadı'}</dd></div>
              <div><dt className="text-slate-500">Termin</dt><dd className="mt-1 font-medium">{data.dueAt ? formatDate(data.dueAt) : 'Belirtilmedi'}</dd></div>
              <div><dt className="text-slate-500">İstasyon</dt><dd className="mt-1 font-medium">{data.location || 'Belirtilmedi'}</dd></div>
            </dl>
            {data.blockedReasonDetail && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Bloke nedeni: {data.blockedReasonDetail}</p>}
          </section>
          <section className="rf-panel p-5">
            <h3 className="font-semibold">Üretim kontrol listesi</h3>
            {data.checklist.length ? <div className="mt-3 space-y-3">{data.checklist.map(item =>
              <label key={item.id} className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={item.completed} disabled={busy !== null || !user?.role || !hasPermission(user.role as UserRole, 'orders.view')} onChange={event => toggle(item.id, event.target.checked)} />
                {item.title} {item.required && <span className="text-xs text-slate-400">Zorunlu</span>}
              </label>
            )}</div> : <p className="mt-2 text-sm text-slate-500">Bu iş emrinde kontrol maddesi yok.</p>}
          </section>
          <section className="rf-panel p-5">
            <h3 className="font-semibold">Atölye notları</h3>
            {data.comments.length ? data.comments.map(comment => <div key={comment.id} className="mt-3 border-t pt-3"><p className="whitespace-pre-wrap text-sm">{comment.body}</p><p className="mt-1 text-xs text-slate-500">{comment.authorName} · {formatDate(comment.createdAt)}</p></div>) : <p className="mt-2 text-sm text-slate-500">Henüz not eklenmedi.</p>}
          </section>
        </>}
      </main>
    </div>
  );
}
