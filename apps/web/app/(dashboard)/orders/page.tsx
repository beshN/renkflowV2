'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, RefreshCw, Download, Trash2, X, CalendarClock, FileText } from 'lucide-react';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { hasPermission } from '@/lib/auth/permissions';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { RFListView, type RFColumn, type RFFilter } from '@/components/shared/views/RFListView';
import { StatusBadge, ORDER_STATUS_STEPS } from '@/components/shared/ui/StatusStepper';
import { businessDate, filterWorkspaceOrders, isOpenOrder, isOverdueOrder, normalizeOrderStatus, ordersCsv, type OrderView } from '@/lib/features/orders/workspace';
import type { Order } from '@/lib/types';
import { SavedOrderViews } from '@/components/features/orders/SavedOrderViews';
import { readOrderFilters, orderFiltersQuery } from '@/lib/features/orders/saved-views';
import { canViewFinancialFields } from '@/lib/auth/permissions';

const views: { id: OrderView; label: string }[] = [{ id: 'all', label: 'Tüm siparişler' }, { id: 'active', label: 'Aktif işler' }, { id: 'overdue', label: 'Gecikenler' }, { id: 'today', label: 'Bugün teslim' }, { id: 'completed', label: 'Tamamlanan' }];
const filters: RFFilter[] = [{ key: 'status', label: 'Sipariş durumu', type: 'select', options: [...ORDER_STATUS_STEPS.map(step => ({ value: step.key, label: step.label })), { value: 'on_hold', label: 'Beklemede' }, { value: 'cancelled', label: 'İptal' }] }];
const stageLabels: Record<string, string> = { intake: 'Yeni talepler', preparation: 'Malzeme hazırlığı', production: 'Üretim', quality: 'Kalite kontrol', shipping: 'Sevkiyat', completed: 'Tamamlanan' };

function OrdersWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { orders, isLoading, error, isValidating, refresh, deleteOrder } = useOrders();
  const [selected, setSelected] = useState<Order[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const currentFilters = readOrderFilters(params);
  const { view, q: query, status, stage, sort } = currentFilters;
  const financialAccess = Boolean(user && canViewFinancialFields(user.role));
  const [deleteError, setDeleteError] = useState('');
  const today = businessDate();
  const filtered = useMemo(() => filterWorkspaceOrders(orders, { query, status, stage, view, sort, today }), [orders, query, status, stage, view, sort, today]);
  const counts: Record<OrderView, number> = { all: orders.length, active: orders.filter(isOpenOrder).length, overdue: orders.filter(order => isOverdueOrder(order, today)).length, today: orders.filter(order => isOpenOrder(order) && order.deliveryDate === today).length, completed: orders.filter(order => normalizeOrderStatus(order.status) === 'completed').length };
  function updateParams(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    const search = next.toString();
    window.history.replaceState(null, '', pathname + (search ? '?' + search : ''));
    setSelected([]);
  }
  async function reload() { try { await refresh(); } catch { showToast('Sipariş listesi yenilenemedi.', 'error'); } }
  function exportCsv() {
    const rows = selected.length ? selected : filtered;
    const url = URL.createObjectURL(new Blob([ordersCsv(rows, financialAccess)], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `renkflow-siparisler-${today}.csv`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${rows.length} sipariş CSV olarak dışa aktarıldı.`, 'success');
  }
  async function removeSelected() {
    setDeleting(true); setDeleteError('');
    let removed = 0; const failed: Order[] = []; const reasons: string[] = [];
    try {
      for (const order of selected) {
        try { await deleteOrder(order.id); removed++; }
        catch (error) { failed.push(order); reasons.push(`${order.orderNumber}: ${error instanceof Error ? error.message : 'Silinemedi'}`); }
      }
      setSelected(failed);
      if (failed.length) setDeleteError(`${removed} sipariş silindi. ${failed.length} kayıt korundu. ${reasons.join(' · ')}`);
      else { setDeleteOpen(false); showToast(`${removed} sipariş silindi.`, 'success'); }
    } finally { setDeleting(false); }
  }
  const columns: RFColumn<Order>[] = [
    { key: 'orderNumber', label: 'Sipariş', width: 'w-32', render: (_, row) => <Link href={'/orders/' + row.id} onClick={event => event.stopPropagation()} className="font-semibold text-primary hover:underline">{row.orderNumber}</Link> },
    { key: 'customerName', label: 'Müşteri / ürün', render: (_, row) => <div className="min-w-[180px]"><p className="font-medium">{row.customerName}</p><p className="mt-1 max-w-[260px] truncate text-[11px] text-muted-foreground">{row.productName || 'Ürün belirtilmedi'}</p></div> },
    { key: 'quantity', label: 'Adet', align: 'right', width: 'w-16', render: value => <span className="tabular-nums">{value ?? '—'}</span> },
    { key: 'deliveryDate', label: 'Termin', width: 'w-36', render: (_, row) => <div className="whitespace-nowrap"><span className={cn('text-xs', isOverdueOrder(row, today) ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>{row.deliveryDate ? formatDate(row.deliveryDate) : 'Belirlenmedi'}</span>{isOverdueOrder(row, today) && <span className="mt-1 block text-[9px] font-medium text-amber-600">Termin geçti</span>}</div> },
    { key: 'status', label: 'Durum', width: 'w-44', render: value => <StatusBadge status={value} /> },
    ...(financialAccess ? [{ key: 'totalAmount', label: 'Sipariş tutarı', align: 'right', width: 'w-36', render: (value, row) => <span className="whitespace-nowrap text-xs font-medium tabular-nums">{value === 0 ? 'Fiyat bekliyor' : formatCurrency(value, row.currency)}</span> } satisfies RFColumn<Order>] : []),
  ];
  return <div className="rf-page space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="rf-eyebrow">Sipariş & üretim</p><h1 className="rf-page-title">Sipariş çalışma alanı</h1><p className="mt-2 text-xs text-muted-foreground">Müşteri talepleri, teknik bilgiler ve terminleri tek listeden yönetin.</p></div>
      <div className="flex flex-wrap items-center gap-2"><button onClick={reload} disabled={isValidating || isLoading} className="rf-icon-button border border-border bg-card disabled:opacity-40" aria-label="Siparişleri yenile"><RefreshCw size={15} className={isValidating ? 'animate-spin' : ''} /></button>
        <button onClick={exportCsv} disabled={isLoading || Boolean(error) || !filtered.length} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium disabled:opacity-40"><Download size={14} /> CSV dışa aktar</button>
        {user && hasPermission(user.role, 'orders.create') && <Link href="/new-order" className="rf-primary-button h-9 items-center gap-2 px-3 text-xs"><Plus size={14} /> Yeni sipariş</Link>}
      </div>
    </div>
    {user && <SavedOrderViews key={`${user.tenantId}:${user.id}:${user.role}`} filters={currentFilters} selectedId={params.get('savedView') || ''} onApply={(filters,id)=>{
      const query=orderFiltersQuery(filters),next=new URLSearchParams(query);if(id)next.set('savedView',id);
      window.history.pushState(null,'',pathname+(next.toString()?'?'+next.toString():''));setSelected([]);
    }}/>}
    <div className="rf-tabs" role="group" aria-label="Sipariş görünümleri">{views.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} onClick={() => updateParams({ view: item.id === 'all' ? '' : item.id, status: '', stage: '' })}>{item.label}<span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{isLoading || error && !orders.length ? '—' : counts[item.id]}</span></button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><FileText size={14} /><span>{isLoading ? 'Siparişler yükleniyor…' : `${filtered.length} sipariş`}</span>{stage && stageLabels[stage] && <button onClick={() => updateParams({ stage: '' })} className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[10px]">{stageLabels[stage]}<X size={12} /></button>}{status && <button onClick={() => updateParams({ status: '' })} className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[10px]">{ORDER_STATUS_STEPS.find(step => step.key === normalizeOrderStatus(status))?.label || status}<X size={12} /></button>}
        {(status || query || stage) && <button type="button" onClick={() => updateParams({ status: '', q: '', stage: '' })} className="text-[11px] text-primary hover:underline">Filtreleri temizle</button>}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">Sıralama<select aria-label="Sıralama" value={sort} onChange={event => updateParams({ sort: event.target.value })} className="rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground"><option value="newest">En yeni sipariş</option><option value="oldest">En eski sipariş</option><option value="delivery">Yaklaşan termin</option><option value="customer">Müşteri A–Z</option></select></label>
    </div>
    {selected.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-xs"><span className="font-medium">{selected.length} sipariş seçildi</span><button onClick={exportCsv} className="flex items-center gap-1.5 text-primary"><Download size={13} /> Seçimi dışa aktar</button>{user && hasPermission(user.role, 'orders.delete') && <button onClick={() => {setDeleteError('');setDeleteOpen(true);}} className="ml-auto flex items-center gap-1.5 text-rose-600"><Trash2 size={13} /> Seçili siparişleri sil</button>}<button onClick={() => setSelected([])} aria-label="Seçimi temizle" className="rf-icon-button h-6 w-6"><X size={14} /></button></div>}
    <RFListView<Order> hideHeader title="Siparişler" data={filtered} columns={columns} filters={filters} filterValues={{ status }} onFilterChange={(key, value) => updateParams({ [key]: value, stage: '' })}
      searchValue={query} onSearch={value => updateParams({ q: value })} isLoading={isLoading} error={error ? 'Siparişler alınamadı. Bağlantıyı kontrol edin.' : undefined} onRetry={reload}
      onRowClick={row => router.push('/orders/' + row.id)} onRowSelect={setSelected} selectedRows={selected}
      emptyState={{ title: orders.length ? 'Bu görünümde sipariş yok' : 'İlk siparişinizi oluşturun', description: orders.length ? 'Aramayı veya filtreleri değiştirerek diğer siparişleri görüntüleyebilirsiniz.' : 'Müşteri, ürün ve termin bilgilerini girerek sipariş akışını başlatın.' }} />
    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><CalendarClock size={12} /> Termin hesapları Türkiye saatine göre yapılır. Tutarlar kendi para biriminde gösterilir.</p>
    <Dialog.Root open={deleteOpen} onOpenChange={value => { if (!deleting) setDeleteOpen(value); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/45" /><Dialog.Content className="rf-command-dialog fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl">
      <Dialog.Title className="text-lg font-semibold">{selected.length} sipariş silinecek</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">Yalnız işleme alınmamış, bağlantısız siparişler silinir. Üretim, teklif, stok veya finans geçmişi olan kayıtlar korunur. Silme geri alınamaz.</Dialog.Description>{deleteError && <p role="alert" className="mt-4 text-sm text-red-600">{deleteError}</p>}<div className="mt-6 flex justify-end gap-2"><Dialog.Close disabled={deleting} className="rounded-md border border-border px-4 py-2 text-sm">Vazgeç</Dialog.Close><button onClick={removeSelected} disabled={deleting} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{deleting ? 'Siliniyor…' : 'Siparişleri sil'}</button></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}

export default function OrdersPage() {
  return <Suspense fallback={<div className="rf-page"><div className="h-48 animate-pulse rounded-lg bg-muted" /></div>}><OrdersWorkspace /></Suspense>;
}
