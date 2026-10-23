'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, CheckSquare, LayoutGrid, MessageSquare, Plus, RefreshCw, Search } from 'lucide-react';
import { RFKanbanView } from '@/components/shared/views/RFKanbanView';
import { KanbanCardDialog } from '@/components/work-orders/KanbanCardDialog';
import { Navbar } from '@/components/layout/Navbar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { listKanbanWorkOrders, listTenantMembers, updateWorkOrder, type TenantMember, type WorkOrder, type WorkOrderCapabilities, type WorkOrderPriority, type WorkOrderStatus, type WorkOrderBlockReasonCategory } from '@/lib/features/work-orders/client';
import { BLOCK_LABELS, cardPlacement, KANBAN_COLUMNS, optimisticCardMove, PRIORITY_LABELS, READONLY_CAPABILITIES } from '@/lib/features/work-orders/kanban';
import { canTransitionWorkOrderStatus } from '@/lib/features/work-orders/status';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { cn } from '@/lib/utils';

type Move = { id: string; target: WorkOrderStatus; placement: ReturnType<typeof cardPlacement> };
const priorityColor = { low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', medium: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300', high: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300', critical: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' };
const overdue = (card: WorkOrder) => !!card.dueAt && !['done','cancelled'].includes(card.status) && new Date(card.dueAt).getTime() < Date.now();

export default function KanbanPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [capabilities, setCapabilities] = useState<WorkOrderCapabilities>(READONLY_CAPABILITIES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [due, setDue] = useState('all');
  const [showCancelled, setShowCancelled] = useState(false);
  const [blockMove, setBlockMove] = useState<Move | null>(null);
  const [blockCategory, setBlockCategory] = useState<WorkOrderBlockReasonCategory>('material');
  const [blockDetail, setBlockDetail] = useState('');
  const request = useRef(0);
  const saving = useRef(false);

  const load = useCallback(async (silent = false) => {
    const sequence = ++request.current;
    if (!silent) setRefreshing(true);
    try {
      const result = await listKanbanWorkOrders();
      if (request.current !== sequence) return;
      setItems(result.data); setCapabilities(result.capabilities || READONLY_CAPABILITIES); setError('');
    } catch (err) { if (request.current === sequence) setError(err instanceof Error ? err.message : 'Pano yüklenemedi.'); }
    finally { if (request.current === sequence) { setLoading(false); setRefreshing(false); } }
  }, []);
  useEffect(() => { if (!isLoading && !user) router.replace('/login'); }, [isLoading, user, router]);
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true); setItems([]); setCapabilities(READONLY_CAPABILITIES);
    void load();
    return () => { ++request.current; };
  }, [user?.id, user?.tenantId, load]);
  useEffect(() => {
    if (!user?.id || !capabilities.assign) return;
    let active = true;
    listTenantMembers().then(result => { if (active) setMembers(result); }).catch(() => { if (active) setMembers([]); });
    return () => { active = false; };
  }, [user?.id, user?.tenantId, capabilities.assign]);
  useEffect(() => {
    if (!user) return;
    const refresh = () => { if (!saving.current && !cardId && !blockMove && document.visibilityState === 'visible') void load(true); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user, load, cardId, blockMove]);

  const filtered = useMemo(() => items.filter(card => {
    const text = [card.title, card.description, card.category, card.assigneeName, card.location].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
    if (search.trim() && !text.includes(search.trim().toLocaleLowerCase('tr-TR'))) return false;
    if (priority !== 'all' && card.priority !== priority) return false;
    if (assignee === 'mine' && card.assignedTo !== user?.id) return false;
    if (assignee === 'unassigned' && card.assignedTo) return false;
    if (!['all','mine','unassigned'].includes(assignee) && card.assignedTo !== assignee) return false;
    if (due === 'overdue' && !overdue(card)) return false;
    if (due === 'today' && (!card.dueAt || new Date(card.dueAt).toLocaleDateString() !== new Date().toLocaleDateString())) return false;
    return true;
  }), [items, search, priority, assignee, due, user?.id]);
  const columns = KANBAN_COLUMNS.filter(column => column.id !== 'cancelled' || showCancelled).map(column => ({ ...column, addEnabled: column.id === 'open' && capabilities.create, items: filtered.filter(card => card.status === column.id) }));
  const assignees = useMemo(() => [...new Map([...members.map(member => [member.id, member.name] as const), ...items.filter(card => card.assignedTo).map(card => [card.assignedTo!, card.assigneeName || 'Ekip üyesi'] as const)]).entries()], [members, items]);

  async function persistMove(move: Move, blocked?: { blockedReasonCategory: WorkOrderBlockReasonCategory; blockedReasonDetail: string }) {
    if (saving.current) return false;
    const card = items.find(item => item.id === move.id);
    if (!card) return false;
    saving.current = true; ++request.current; setPending(move.id); setError('');
    const before = items;
    setItems(optimisticCardMove(items, move.id, move.target, move.placement));
    try {
      const saved = await updateWorkOrder(move.id, { status: move.target, boardPlacement: move.placement, expectedUpdatedAt: card.updatedAt, expectedRevision: card.revision, ...blocked });
      setItems(current => current.map(item => item.id === saved.id ? saved : item));
      showToast('Kart kaydedildi.', 'success');
      await load(true);
      return true;
    } catch (err) {
      setItems(before);
      const message = err instanceof Error ? err.message : 'Kart taşınamadı; önceki konumu korundu.';
      showToast(message, 'error');
      await load(true); setError(message);
      return false;
    } finally { saving.current = false; setPending(null); setRefreshing(false); }
  }
  function moveCard(id: string, source: string, target: string, index: number) {
    if (saving.current || !capabilities.transition) return;
    const card = items.find(item => item.id === id);
    const column = columns.find(item => item.id === target);
    if (!card || !column) return;
    if (source === target && column.items.findIndex(item => item.id === id) === index) return;
    if (source !== target && card.manufacturing) { showToast('Bu üretim emrinin durumunu malzeme aktarımı / üretim kaydı ile değiştirin.', 'info'); setCardId(id); return; }
    if (!canTransitionWorkOrderStatus(card.status, column.id)) { showToast('Bu geçiş üretim akışına uygun değil. Önce işi başlatın veya kart detayındaki uygun sütunu seçin.', 'error'); return; }
    if (['done','cancelled'].includes(target) && source !== target && !capabilities.close) { showToast('Bu kartı kapatma yetkiniz yok.', 'error'); return; }
    const move = { id, target: column.id, placement: cardPlacement(column.items, id, index) };
    if (target === 'blocked' && source !== target) {
      if (!capabilities.edit) { showToast('Bloke nedeni ekleme yetkiniz yok.', 'error'); return; }
      setBlockCategory('material'); setBlockDetail(''); setBlockMove(move); return;
    }
    void persistMove(move);
  }
  function changed(card: WorkOrder) {
    setItems(current => current.some(item => item.id === card.id) ? current.map(item => item.id === card.id ? card : item) : [card, ...current]);
    void load(true);
  }

  if (isLoading || !user) return null;
  return <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
    <Navbar title="Akış Kanbanı" />
    <div className="mx-auto w-full min-w-0 max-w-[1800px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LayoutGrid size={24} /></div>
        <div className="min-w-0 flex-1"><h1 className="text-xl font-semibold tracking-tight md:text-2xl">Üretim akışı</h1><p className="mt-1 text-sm text-muted-foreground">İşleri planlayın, ekiple paylaşın ve ilerlemeyi takip edin.</p></div>
        <button type="button" onClick={() => void load()} disabled={refreshing || pending !== null} className="rf-input flex min-h-11 items-center gap-2 px-3 text-sm disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />Yenile</button>
        {capabilities.create && <button type="button" onClick={() => setCardId('new')} disabled={pending !== null} className="rf-primary-button flex min-h-11 items-center gap-2"><Plus size={18} />Yeni kart</button>}
      </header>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><span><b className="tabular-nums">{items.filter(card => !['done','cancelled'].includes(card.status)).length}</b> aktif iş</span><span className="text-amber-700 dark:text-amber-300"><b>{items.filter(card => card.status === 'blocked').length}</b> bloke</span><span className="text-rose-700 dark:text-rose-300"><b>{items.filter(overdue).length}</b> geciken</span><span className="text-muted-foreground">{items.length} kart · {filtered.filter(card => card.status !== 'cancelled' || showCancelled).length} gösteriliyor</span>{pending && <span role="status" className="ml-auto text-primary">Kart kaydediliyor…</span>}</div>
      <section aria-label="Pano filtreleri" className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/20 p-3">
        <label className="relative min-w-0 flex-1 basis-56"><Search size={17} aria-hidden="true" className="absolute left-3 top-3.5 text-muted-foreground" /><input type="search" aria-label="Kartlarda ara" maxLength={120} placeholder="Kart, etiket veya sorumlu ara…" value={search} onChange={event => setSearch(event.target.value)} className="rf-input min-h-11 w-full pl-10 text-sm" /></label>
        <select aria-label="Öncelik filtresi" value={priority} onChange={event => setPriority(event.target.value)} className="rf-input min-h-11 flex-1 px-3 text-sm sm:flex-none"><option value="all">Tüm öncelikler</option>{Object.entries(PRIORITY_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Sorumlu filtresi" value={assignee} onChange={event => setAssignee(event.target.value)} className="rf-input min-h-11 flex-1 px-3 text-sm sm:flex-none"><option value="all">Tüm ekip</option><option value="mine">Bana atananlar</option><option value="unassigned">Atanmamış</option>{assignees.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select>
        <select aria-label="Termin filtresi" value={due} onChange={event => setDue(event.target.value)} className="rf-input min-h-11 flex-1 px-3 text-sm sm:flex-none"><option value="all">Tüm terminler</option><option value="today">Bugün</option><option value="overdue">Gecikenler</option></select>
        <label className="flex min-h-11 items-center gap-2 px-2 text-sm"><input type="checkbox" checked={showCancelled} onChange={event => setShowCancelled(event.target.checked)} />İptal edilenler</label>
        {(search || priority !== 'all' || assignee !== 'all' || due !== 'all') && <button type="button" className="min-h-11 px-3 text-sm text-primary" onClick={() => { setSearch(''); setPriority('all'); setAssignee('all'); setDue('all'); }}>Filtreleri temizle</button>}
      </section>
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><span className="flex-1">{error}</span><button type="button" disabled={pending !== null} onClick={() => void load()} className="font-semibold underline">Yeniden dene</button></div>}
      {!loading && !capabilities.transition && <p className="text-xs text-muted-foreground">Görüntüleme erişimi: kart detaylarını açabilirsiniz. Taşıma ve düzenleme yetkiye göre kullanılabilir.</p>}
      <RFKanbanView columns={columns} getItemLabel={card => card.title} isLoading={loading} disabled={pending !== null || refreshing} onDragEnd={capabilities.transition ? moveCard : undefined} onAddCard={capabilities.create ? () => setCardId('new') : undefined} renderCard={(card, overlay) => <button type="button" disabled={overlay || pending !== null} onClick={() => setCardId(card.id)} className={cn('w-full rounded-xl border border-border bg-background p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', card.status === 'blocked' && 'border-amber-300 dark:border-amber-800')}>
        <div className="mb-2 flex items-center gap-2 pr-9"><span className="max-w-full truncate rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">{card.category}</span>{card.priority !== 'medium' && <span className={cn('rounded-md px-2 py-1 text-[11px] font-semibold', priorityColor[card.priority as WorkOrderPriority])}>{PRIORITY_LABELS[card.priority]}</span>}</div>
        <p className="break-words pr-9 text-sm font-semibold leading-6">{card.title}</p>
        {card.description && <p className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{card.description}</p>}
        {card.blockedReasonDetail && <p className="mt-3 line-clamp-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{card.blockedReasonDetail}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {card.dueAt && <span className={cn('flex items-center gap-1 rounded-md px-1.5 py-1 tabular-nums', overdue(card) ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-muted')} title={new Date(card.dueAt).toLocaleString('tr-TR')}><CalendarClock size={13} />{new Date(card.dueAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>}
          {card.checklistTotal > 0 && <span className={cn('flex items-center gap-1 tabular-nums', card.checklistCompleted === card.checklistTotal && 'text-emerald-600')} aria-label={'Kontrol listesi: ' + card.checklistCompleted + '/' + card.checklistTotal}><CheckSquare size={13} />{card.checklistCompleted}/{card.checklistTotal}</span>}
          {card.commentTotal > 0 && <span className="flex items-center gap-1"><MessageSquare size={13} />{card.commentTotal}</span>}
          {card.assigneeName && <span title={card.assigneeName} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary" aria-label={'Sorumlu: ' + card.assigneeName}>{card.assigneeName.split(' ').map(word => word[0]).slice(0,2).join('').toLocaleUpperCase('tr-TR')}</span>}
        </div>
      </button>} />
      <p className="text-xs text-muted-foreground">Taşıma tutamacını sürükleyin; klavyede boşluk ve ok tuşlarını kullanın. Kartı açarak sütunu da değiştirebilirsiniz.</p>
      {cardId && <KanbanCardDialog key={cardId} cardId={cardId} capabilities={capabilities} members={members} onClose={() => setCardId(null)} onChanged={changed} />}
      <Dialog open={!!blockMove} onOpenChange={open => { if (!open && !saving.current) setBlockMove(null); }}><DialogContent showCloseButton={pending === null}><DialogHeader><DialogTitle>Bloke nedenini belirtin</DialogTitle><DialogDescription>Kartın neden beklediğini ekibin görebilmesi için bir açıklama ekleyin.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={event => { event.preventDefault(); if (blockMove) void persistMove(blockMove, { blockedReasonCategory: blockCategory, blockedReasonDetail: blockDetail.trim() }).then(ok => { if (ok) setBlockMove(null); }); }}><label className="block text-sm">Neden<select disabled={pending !== null} className="rf-input mt-1 min-h-11 w-full" value={blockCategory} onChange={event => setBlockCategory(event.target.value as WorkOrderBlockReasonCategory)}>{Object.entries(BLOCK_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm">Açıklama<textarea autoFocus required minLength={5} maxLength={1000} disabled={pending !== null} value={blockDetail} onChange={event => setBlockDetail(event.target.value)} className="rf-input mt-1 min-h-24 w-full" placeholder="Örn. Motor tedariki bekleniyor." /></label><button className="rf-primary-button min-h-11 w-full" disabled={pending !== null || blockDetail.trim().length < 5}>{pending ? 'Kaydediliyor…' : 'Nedeni kaydet ve taşı'}</button></form></DialogContent></Dialog>
    </div>
  </div>;
}
