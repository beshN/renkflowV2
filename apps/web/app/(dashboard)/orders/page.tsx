'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, RefreshCw, Download, Trash2, X, FileText, List, Columns3, AlertOctagon, Truck, Activity, ScanText } from 'lucide-react';
import { toast } from 'sonner';
import { HealthBadge, HintTip, LifecycleStrip, PageHeader, withUndo } from '@/components/kit';
import { OrdersBoard } from '@/components/features/orders/OrdersBoard';
import { RecordButton } from '@/components/records/RecordDrawer';
import { LIFECYCLE, dropPath, lifecycleIndex, orderHealth, type LifecycleKey } from '@/lib/features/orders/lifecycle';
import { requestOrderTransition } from '@/lib/features/orders/client-transition';
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
import { CopyChip } from '@/components/spells/CopyChip';

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
  const mode = params.get('mode') === 'board' ? 'board' : 'list';
  const lc = params.get('lc') as LifecycleKey | null;
  const lcIndex = LIFECYCLE.findIndex((step) => step.key === lc);
  // Changes waiting for their undo window: shown at once, sent when the window closes.
  const [pending, setPending] = useState<Record<string, { status?: string; deliveryDate?: string; token: number }>>({});
  const shown = useMemo(() => orders.map((o) => (pending[o.id] ? ({ ...o, ...pending[o.id] } as Order) : o)), [orders, pending]);
  const filtered = useMemo(() => filterWorkspaceOrders(shown, { query, status, stage, view, sort, today }).filter((o) => lcIndex < 0 || lifecycleIndex(o.status) === lcIndex), [shown, query, status, stage, view, sort, today, lcIndex]);
  const canMove = Boolean(user && hasPermission(user.role, 'orders.edit'));
  // Each change clears only its own overlay; a newer change on the same order keeps its own.
  const clearPending = (ids: string[], token: number) => setPending((current) => { const next = { ...current }; ids.forEach((id) => { if (next[id]?.token === token) delete next[id]; }); return next; });
  const pendingIds = Object.keys(pending);
  /** Status changes with undo: one toast for one order or a whole selection. */
  function moveOrders(requested: Array<{ order: Order; path: string[] }>) {
    // One change at a time per order: the next one waits until this one is saved and reloaded.
    const moves = requested.filter((m) => !pendingIds.includes(m.order.id));
    if (moves.length < requested.length) toast.warning('Önceki değişiklik kaydediliyor; birkaç saniye sonra tekrar deneyin');
    if (!moves.length) return;
    const token = Date.now() + Math.random();
    setPending((current) => ({ ...current, ...Object.fromEntries(moves.map((m) => [m.order.id, { status: m.path[m.path.length - 1], token }])) }));
    const label = (st: string) => ORDER_STATUS_STEPS.find((x) => x.key === st)?.label ?? st;
    withUndo({
      message: moves.length === 1 ? `${moves[0].order.orderNumber} → ${label(moves[0].path[moves[0].path.length - 1])}` : `${moves.length} sipariş taşındı`,
      undo: () => clearPending(moves.map((m) => m.order.id), token),
      commit: async () => {
        const failed: string[] = [];
        for (const m of moves) {
          // Each move is a separate checked transition; the next one uses the version the last returned.
          // If one is refused half way, the order stays where the last accepted move put it, and we say so.
          let reached = m.order.status as string;
          try {
            let version = m.order.version;
            for (const status of m.path) { version = (await requestOrderTransition({ id: m.order.id, version }, status)).version; reached = status; }
          }
          catch (e) { failed.push(`${m.order.orderNumber}: ${e instanceof Error ? e.message : 'kaydedilemedi'}${reached !== m.order.status ? ` (şu an: ${ORDER_STATUS_STEPS.find((x) => x.key === reached)?.label ?? reached})` : ''}`); }
        }
        await refresh().catch(() => undefined);
        clearPending(moves.map((m) => m.order.id), token);
        if (failed.length) toast.error(failed.join(' · '));
      },
    });
  }
  function moveSelectedTo(step: LifecycleKey) {
    const moves = selected.flatMap((order) => {
      const current = shown.find((o) => o.id === order.id) ?? order;
      const path = current.productionManaged ? null : dropPath(current.status, step);
      return path ? [{ order: current, path }] : [];
    });
    const skipped = selected.length - moves.length;
    if (skipped) toast.warning(`${skipped} sipariş bu adıma doğrudan geçemez; dokunulmadı`);
    moveOrders(moves);
    setSelected([]);
  }
  function changeDeliveryDate(order: Order, deliveryDate: string) {
    if (!deliveryDate || deliveryDate === order.deliveryDate) return;
    if (pendingIds.includes(order.id)) { toast.warning('Önceki değişiklik kaydediliyor; birkaç saniye sonra tekrar deneyin'); return; }
    const token = Date.now() + Math.random();
    setPending((current) => ({ ...current, [order.id]: { deliveryDate, token } }));
    withUndo({
      message: `${order.orderNumber} termini ${formatDate(deliveryDate)}`,
      undo: () => clearPending([order.id], token),
      commit: async () => {
        const res = await fetch('/api/v1/orders/' + order.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deliveryDate }) });
        if (!res.ok) { clearPending([order.id], token); throw new Error((await res.json().catch(() => ({}))).error || 'Termin kaydedilemedi'); }
        await refresh().catch(() => undefined);
        clearPending([order.id], token);
      },
    });
  }
  const [editingDate, setEditingDate] = useState<string | null>(null);
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
    { key: 'orderNumber', label: 'Sipariş', width: 'w-32', render: (_, row) => <span className="group inline-flex items-center gap-1"><Link href={'/orders/' + row.id} onClick={event => event.stopPropagation()} className="font-semibold text-primary hover:underline">{row.orderNumber}</Link><CopyChip value={row.orderNumber} label="Sipariş numarasını" /></span> },
    { key: 'customerName', label: 'Müşteri / ürün', render: (_, row) => <div className="min-w-[180px]"><p className="font-medium">{row.customerName}</p><p className="mt-1 max-w-[260px] truncate text-[11px] text-muted-foreground">{row.productName || 'Ürün belirtilmedi'}</p></div> },
    { key: 'quantity', label: 'Adet', align: 'right', width: 'w-16', render: value => <span className="tabular-nums">{value ?? '—'}</span> },
    { key: 'deliveryDate', label: 'Termin', width: 'w-36', render: (_, row) => editingDate === row.id
      ? <input type="date" autoFocus aria-label={`${row.orderNumber} termini`} defaultValue={row.deliveryDate ?? ''} className="rf-input h-8 w-36 text-xs" onClick={(e) => e.stopPropagation()}
          onBlur={(e) => { setEditingDate(null); changeDeliveryDate(row, e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingDate(null); }} />
      : <button type="button" className="space-y-1 whitespace-nowrap text-left" title={canMove ? 'Değiştirmek için çift tıklayın ya da Enter' : undefined}
          aria-label={`${row.orderNumber} termini ${row.deliveryDate ? formatDate(row.deliveryDate) : 'yok'}${canMove ? ', değiştirmek için Enter' : ''}`}
          onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); if (canMove) setEditingDate(row.id); }}
          onKeyDown={(e) => { if (canMove && (e.key === 'Enter' || e.key === 'F2' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); setEditingDate(row.id); } }}>
          <span className="block text-xs tabular-nums">{row.deliveryDate ? formatDate(row.deliveryDate) : '—'}</span>
          <HealthBadge health={orderHealth(row, today)} />
        </button> },
    { key: 'status', label: 'Aşama', width: 'w-56', render: (value) => <div className="min-w-[180px] space-y-1"><LifecycleStrip status={value} compact /><StatusBadge status={value} /></div> },
    { key: 'id', label: '', width: 'w-12', render: (_, row) => <RecordButton type="order" id={row.id} compact /> },
    ...(financialAccess ? [{ key: 'totalAmount', label: 'Sipariş tutarı', align: 'right', width: 'w-36', render: (value, row) => <span className="whitespace-nowrap text-xs font-medium tabular-nums">{value === 0 ? 'Fiyat bekliyor' : formatCurrency(value, row.currency)}</span> } satisfies RFColumn<Order>] : []),
  ];
  return <div className="rf-page space-y-5">
    <PageHeader eyebrow="Sipariş & üretim" title="Siparişler" hint="Termin hesapları Türkiye saatine göredir. Tutarlar kendi para biriminde gösterilir. Terminin üstüne çift tıklayarak ya da Enter ile değiştirin; kartı sürükleyerek aşamasını değiştirin, birkaç saniye içinde geri alabilirsiniz."
      kpis={[
        { label: 'açık', value: isLoading ? '·' : counts.active, icon: Activity, href: '/orders?view=active' },
        { label: 'geciken', value: isLoading ? '·' : counts.overdue, icon: AlertOctagon, href: '/orders?view=overdue', tone: counts.overdue ? 'danger' : 'neutral' },
        { label: 'bugün', value: isLoading ? '·' : counts.today, icon: Truck, href: '/orders?view=today' },
      ]}
      action={<>
        <div role="group" aria-label="Görünüm" className="flex rounded-md border border-border p-0.5">
          <button type="button" aria-pressed={mode === 'list'} aria-label="Liste" onClick={() => updateParams({ mode: '' })} className={cn('grid h-8 w-8 place-items-center rounded', mode === 'list' && 'bg-primary/10 text-primary')}><List size={16} /></button>
          <button type="button" aria-pressed={mode === 'board'} aria-label="Pano" onClick={() => updateParams({ mode: 'board' })} className={cn('grid h-8 w-8 place-items-center rounded', mode === 'board' && 'bg-primary/10 text-primary')}><Columns3 size={16} /></button>
        </div>
        <button onClick={reload} disabled={isValidating || isLoading} className="rf-icon-button grid h-9 w-9 place-items-center border border-border bg-card disabled:opacity-40" aria-label="Siparişleri yenile"><RefreshCw size={15} className={isValidating ? 'animate-spin motion-reduce:animate-none' : ''} /></button>
        <button onClick={exportCsv} disabled={isLoading || Boolean(error) || !filtered.length} aria-label="CSV dışa aktar" className="rf-icon-button grid h-9 w-9 place-items-center border border-border bg-card disabled:opacity-40"><Download size={15} /></button>
        {user && hasPermission(user.role, 'orders.create') && <Link href="/orders/foy" className="rf-secondary-button h-9 items-center gap-2 px-3 text-xs"><ScanText size={14} /> Föy oku</Link>}
        {user && hasPermission(user.role, 'orders.create') && <Link href="/new-order" className="rf-primary-button h-9 items-center gap-2 px-3 text-xs"><Plus size={14} /> Yeni sipariş</Link>}
      </>} />
    {user && <details className="group" open={Boolean(params.get('savedView'))}>
      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">Kayıtlı görünümler</summary>
      <div className="mt-2"><SavedOrderViews key={`${user.tenantId}:${user.id}:${user.role}`} filters={currentFilters} selectedId={params.get('savedView') || ''} onApply={(filters,id)=>{
      const query=orderFiltersQuery(filters),next=new URLSearchParams(query);if(id)next.set('savedView',id);
      window.history.pushState(null,'',pathname+(next.toString()?'?'+next.toString():''));setSelected([]);
    }}/></div>
    </details>}
    <div className="rf-tabs" role="group" aria-label="Sipariş görünümleri">{views.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} onClick={() => updateParams({ view: item.id === 'all' ? '' : item.id, status: '', stage: '' })}>{item.label}<span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{isLoading || error && !orders.length ? '—' : counts[item.id]}</span></button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><FileText size={14} aria-hidden /><span className="tabular-nums">{isLoading ? '·' : filtered.length}</span>{lcIndex >= 0 && <button onClick={() => updateParams({ lc: '' })} className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[10px]">{LIFECYCLE[lcIndex].label}<X size={12} /></button>}{stage && stageLabels[stage] && <button onClick={() => updateParams({ stage: '' })} className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[10px]">{stageLabels[stage]}<X size={12} /></button>}{status && <button onClick={() => updateParams({ status: '' })} className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[10px]">{ORDER_STATUS_STEPS.find(step => step.key === normalizeOrderStatus(status))?.label || status}<X size={12} /></button>}
        {(status || query || stage || lc) && <button type="button" onClick={() => updateParams({ status: '', q: '', stage: '', lc: '' })} className="text-[11px] text-primary hover:underline">Filtreleri temizle</button>}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">Sıralama<select aria-label="Sıralama" value={sort} onChange={event => updateParams({ sort: event.target.value })} className="rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground"><option value="newest">En yeni sipariş</option><option value="oldest">En eski sipariş</option><option value="delivery">Yaklaşan termin</option><option value="customer">Müşteri A–Z</option></select></label>
    </div>
    {selected.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-xs"><span className="font-medium tabular-nums">{selected.length} seçili</span>{canMove && <label className="flex items-center gap-1.5">Adıma taşı<select aria-label="Seçilenleri adıma taşı" className="rf-input h-8 py-0 text-xs" value="" onChange={(e) => e.target.value && moveSelectedTo(e.target.value as LifecycleKey)}><option value="">—</option>{LIFECYCLE.map((step) => <option key={step.key} value={step.key}>{step.label}</option>)}</select></label>}<button onClick={exportCsv} className="flex items-center gap-1.5 text-primary"><Download size={13} /> CSV</button>{user && hasPermission(user.role, 'orders.delete') && <button onClick={() => {setDeleteError('');setDeleteOpen(true);}} className="ml-auto flex items-center gap-1.5 text-rose-600"><Trash2 size={13} /> Seçili siparişleri sil</button>}<button onClick={() => setSelected([])} aria-label="Seçimi temizle" className="rf-icon-button h-6 w-6"><X size={14} /></button></div>}
    {mode === 'board' ? (isLoading ? <div className="flex gap-3">{LIFECYCLE.map((s) => <div key={s.key} className="h-64 flex-1 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}</div>
      : <OrdersBoard orders={filtered} canMove={canMove} onMove={(order, path) => moveOrders([{ order, path }])} />) :
    <RFListView<Order> hideHeader title="Siparişler" data={filtered} columns={columns} filters={filters} filterValues={{ status }} onFilterChange={(key, value) => updateParams({ [key]: value, stage: '' })}
      searchValue={query} onSearch={value => updateParams({ q: value })} isLoading={isLoading} error={error ? 'Siparişler alınamadı. Bağlantıyı kontrol edin.' : undefined} onRetry={reload}
      onRowClick={row => router.push('/orders/' + row.id)} onRowSelect={setSelected} selectedRows={selected}
      emptyState={{ title: orders.length ? 'Bu görünümde sipariş yok' : 'İlk sipariş', description: '', illustration: 'forklift' }} />}
    <Dialog.Root open={deleteOpen} onOpenChange={value => { if (!deleting) setDeleteOpen(value); }}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/45" /><Dialog.Content className="rf-command-dialog fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl">
      <Dialog.Title className="text-lg font-semibold">{selected.length} sipariş silinecek</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">Yalnız işleme alınmamış, bağlantısız siparişler silinir. Üretim, teklif, stok veya finans geçmişi olan kayıtlar korunur. Silme geri alınamaz.</Dialog.Description>{deleteError && <p role="alert" className="mt-4 text-sm text-red-600">{deleteError}</p>}<div className="mt-6 flex justify-end gap-2"><Dialog.Close disabled={deleting} className="rounded-md border border-border px-4 py-2 text-sm">Vazgeç</Dialog.Close><button onClick={removeSelected} disabled={deleting} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{deleting ? 'Siliniyor…' : 'Siparişleri sil'}</button></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}

export default function OrdersPage() {
  return <Suspense fallback={<div className="rf-page"><div className="h-48 animate-pulse rounded-lg bg-muted" /></div>}><OrdersWorkspace /></Suspense>;
}
