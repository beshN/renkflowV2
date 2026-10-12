'use client';

import { PageHeader } from '@/components/kit';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RFKanbanView } from '@/components/shared/views/RFKanbanView';
import { listWorkOrders, WorkOrder } from '@/lib/features/work-orders/client';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';

export default function KanbanPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, router, user]);

  useEffect(() => {
    if (user) fetchWorkOrders();
  }, [user]);

  const fetchWorkOrders = async () => {
    setIsFetching(true);
    try {
      const res = await listWorkOrders();
      setWorkOrders(res.data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsFetching(false);
    }
  };

  const columns = [
    { id: 'open', title: 'Açık', color: 'border-slate-200' },
    { id: 'in_progress', title: 'Devam ediyor', color: 'border-sky-200' },
    { id: 'blocked', title: 'Bloke edildi', color: 'border-rose-200' },
    { id: 'done', title: 'Tamamlandı', color: 'border-emerald-200' },
  ];

  const handleCardMove = async (cardId: string, sourceCol: string, targetCol: string) => {
    // In a real app, we would call the API to update the status.
    // For now, we optimistically update UI.
    setWorkOrders(prev => prev.map(wo => wo.id === cardId ? { ...wo, status: targetCol as any } : wo));
    showToast(`İş Emri taşındı: ${targetCol}`, 'success');
  };

  const kanbanItems = workOrders.map(wo => ({
    id: wo.id,
    columnId: wo.status === 'cancelled' ? 'done' : wo.status,
    title: wo.title,
    description: wo.description || '',
    priority: wo.priority === 'critical' ? 'high' as const : 
              wo.priority === 'high' ? 'high' as const :
              wo.priority === 'medium' ? 'medium' as const : 'low' as const,
    assignee: wo.assigneeName ? { name: wo.assigneeName } : undefined,
    badges: [wo.category]
  }));

  const kanbanColumns = columns.map((column) => ({
    ...column,
    items: kanbanItems.filter((item) => item.columnId === column.id),
  }));

  if (isLoading || !user) return null;

  return (
    <div className="rf-page space-y-5">
        <PageHeader eyebrow="Üretim" title="İş emri akışı" hint="Kartları sürükleyip bırakarak iş emrinin aşamasını değiştirin; karta dokunmak detayını açar." />
        <RFKanbanView
          columns={kanbanColumns}
          onDragEnd={(itemId, sourceColumnId, destinationColumnId) =>
            handleCardMove(itemId, sourceColumnId, destinationColumnId)
          }
          renderCard={(item) => (
            <button
              type="button"
              onClick={() => router.push(`/work-orders/${item.id}`)}
              className="w-full rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-primary/40 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <p className="font-semibold text-foreground">{item.title}</p>
              {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
              <div className="mt-3 flex flex-wrap gap-1">
                {item.badges.map((badge) => (
                  <span key={badge} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">{badge}</span>
                ))}
              </div>
            </button>
          )}
        />
    </div>
  );
}
