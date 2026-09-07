'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RFKanbanView } from '@/components/shared/views/RFKanbanView';
import { Navbar } from '@/components/layout/Navbar';
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
    { id: 'in_progress', title: 'Devam Ediyor', color: 'border-sky-200' },
    { id: 'blocked', title: 'Bloke Edildi', color: 'border-rose-200' },
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

  if (isLoading || !user) return null;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title="Akış Kanbanı" />
      <main className="w-full flex-1 p-4 md:p-8">
        <RFKanbanView
          title="Üretim İş Emirleri"
          description="Sürükle bırak ile iş emirlerini yönetin."
          columns={columns}
          items={kanbanItems}
          onCardMove={handleCardMove}
          onCardClick={(item) => router.push(`/work-orders/${item.id}`)}
        />
      </main>
    </div>
  );
}
