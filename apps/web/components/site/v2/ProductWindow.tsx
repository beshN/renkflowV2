'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, rectIntersection, type CollisionDetection, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { Bell, Boxes, ChevronDown, CornerDownLeft, KanbanSquare, List, ListFilter, Plus, ReceiptText, Search } from 'lucide-react';
import { BrandSymbol } from '@/components/brand/BrandSymbol';
import { cn } from '@/lib/utils';
import { fmt, ITEMS, ORDERS, STAGES, stageIndex, STOCK, type Order, type StageKey } from './model';
import { Initials, StageDot, StageLabel, Swatch, T, Tabs } from './primitives';
import { RecordPanel } from './RecordPanel';

type View = 'orders' | 'stock';
type Layout = 'board' | 'list';
type Filter = 'all' | 'sales' | 'shop' | 'ship';
const FILTERS: Record<Filter, StageKey[]> = {
  all: ['quote', 'approval', 'production', 'cutting', 'assembly', 'delivery'],
  sales: ['quote', 'approval'],
  shop: ['production', 'cutting'],
  ship: ['assembly', 'delivery'],
};
const NAV: Array<{ key: View; label: string; icon: typeof ReceiptText }> = [
  { key: 'orders', label: 'Siparişler', icon: ReceiptText },
  { key: 'stock', label: 'Depo', icon: Boxes },
];

/**
 * The hero: a working slice of the RenkFlow workspace. Orders open in the record drawer, steps move
 * one at a time with undo, ⌘K finds an order or a screen. All data is sample data in the browser.
 */
export function ProductWindow() {
  const [orders, setOrders] = useState<Order[]>(ORDERS);
  const [view, setView] = useState<View>('orders');
  const [layout, setLayout] = useState<Layout>('board');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState<{ id: string; from: StageKey; to: StageKey; n: number; error?: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const open = orders.find((o) => o.id === openId) ?? null;

  // As on the workspace board: an order moves one step forward or back, never skipping a step.
  const moveTo = useCallback((id: string, to: StageKey) => {
    const order = orders.find((o) => o.id === id);
    if (!order || order.stage === to) return;
    if (Math.abs(stageIndex(to) - stageIndex(order.stage)) !== 1) {
      setToast((t) => ({ id, from: order.stage, to, n: (t?.n ?? 0) + 1, error: true }));
      return;
    }
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, stage: to } : o)));
    setToast((t) => ({ id, from: order.stage, to, n: (t?.n ?? 0) + 1 }));
  }, [orders]);
  const advance = useCallback((id: string) => {
    const order = orders.find((o) => o.id === id);
    const next = order && STAGES[stageIndex(order.stage) + 1];
    if (next) moveTo(id, next.key);
  }, [orders, moveTo]);
  const undo = () => {
    if (!toast || toast.error) return;
    setOrders((list) => list.map((o) => (o.id === toast.id ? { ...o, stage: toast.from } : o)));
    setToast(null);
  };
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ⌘K / Ctrl+K opens the palette while the pointer or focus is inside the product, as in the workspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const el = root.current;
        if (el && (el.matches(':hover') || el.contains(document.activeElement))) { e.preventDefault(); setPalette(true); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = useCallback(() => setOpenId(null), []);
  const visible = orders.filter((o) => FILTERS[filter].includes(o.stage));

  return (
    <div ref={root} className="x-window relative text-left">
      <TopBar onSearch={() => setPalette(true)} view={view} layout={layout} />
      <div className="grid h-[560px] grid-cols-1 md:grid-cols-[208px_1fr] lg:h-[600px]">
        <Sidebar view={view} setView={(v) => { setView(v); setOpenId(null); }} counts={{ orders: orders.length, stock: STOCK.length }} />
        <main className="relative min-w-0 overflow-hidden bg-[var(--x-surface)]">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold tracking-[-0.015em]" style={{ fontFamily: 'var(--font-sans)', fontStretch: '100%' }}>{NAV.find((n) => n.key === view)!.label}</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="md:hidden"><Tabs id="pw-mview" label="Ekran" variant="segmented" size="sm" items={NAV.map((n) => ({ key: n.key, label: n.label.split(' ')[0] }))} value={view} onChange={(v) => { setView(v); setOpenId(null); }} /></div>
                <a href="#tekliften-siparise" className="x-ctl x-ctl-ink max-md:!hidden"><Plus size={13} aria-hidden /> Yeni sipariş</a>
              </div>
            </div>
            {view === 'orders' && (
              <div className="flex items-center justify-between gap-3 border-b border-[var(--x-line)] px-4 pb-2.5 sm:px-5">
                <div className="flex items-center gap-2">
                  <Tabs id="pw-layout" label="Görünüm" variant="segmented" size="sm" value={layout} onChange={(l) => setLayout(l)} items={[
                    { key: 'board', label: <span className="flex items-center gap-1.5"><KanbanSquare size={12} aria-hidden />Pano</span> },
                    { key: 'list', label: <span className="flex items-center gap-1.5"><List size={12} aria-hidden />Liste</span> },
                  ]} />
                  {layout === 'list' && (
                    <Tabs id="pw-filter" label="Süzgeç" variant="segmented" size="sm" value={filter} onChange={setFilter} className="max-sm:hidden" items={[
                      { key: 'all', label: 'Tümü', count: orders.length },
                      { key: 'sales', label: 'Satış', count: orders.filter((o) => FILTERS.sales.includes(o.stage)).length },
                      { key: 'shop', label: 'Atölye', count: orders.filter((o) => FILTERS.shop.includes(o.stage)).length },
                      { key: 'ship', label: 'Sevk', count: orders.filter((o) => FILTERS.ship.includes(o.stage)).length },
                    ]} />
                  )}
                </div>
                <span className="hidden items-center gap-1.5 text-[12px] text-[var(--x-muted)] lg:flex"><ListFilter size={13} aria-hidden /> Termine göre</span>
              </div>
            )}
            <div className="relative min-h-0 flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={view === 'orders' ? layout : view} className={cn('absolute inset-0 overflow-auto [scrollbar-width:thin]', view === 'orders' && layout === 'board' && 'pt-3')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.fast}>
                  {view === 'orders' && layout === 'list' && <OrdersTable orders={visible} openId={openId} onOpen={setOpenId} />}
                  {view === 'orders' && layout === 'board' && <Board orders={orders} openId={openId} onOpen={setOpenId} onMove={moveTo} />}
                  {view === 'stock' && <StockView />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {open && <motion.div key="scrim" className="absolute inset-0 z-10 bg-[rgb(30_36_39/0.06)] dark:bg-black/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.base} onClick={close} aria-hidden />}
            {open && <RecordPanel key="panel" order={open} onClose={close} onAdvance={advance} />}
          </AnimatePresence>

          <AnimatePresence>
            {toast && (
              <motion.div key={toast.n} role="status" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} transition={T.base}
                className="absolute bottom-4 left-4 z-30 flex items-center gap-3 rounded-[var(--x-r-panel)] bg-[var(--x-ink)] py-2 pl-3 pr-2 text-[12px] text-[var(--x-surface)] shadow-[var(--x-shadow-pop)]">
                {toast.error ? (
                  <span className="py-1 pr-1"><span className="x-mono">{toast.id}</span>: bu adıma doğrudan geçilemez. Bir önceki ya da bir sonraki aşamaya taşıyın.</span>
                ) : (
                  <>
                    <span><span className="x-mono">{toast.id}</span> {STAGES[stageIndex(toast.to)].label} aşamasına alındı</span>
                    <button type="button" onClick={undo} className="rounded-[4px] px-2 py-1 font-medium text-[var(--x-bronze-fill)] hover:bg-white/10">Geri al</button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <AnimatePresence>{palette && <Palette orders={orders} onClose={() => setPalette(false)} onPick={(pick) => { setPalette(false); if (pick.type === 'order') { setOpenId(pick.id); setView('orders'); setFilter('all'); } else { setView(pick.view); setOpenId(null); } }} />}</AnimatePresence>
    </div>
  );
}

function TopBar({ onSearch, view, layout }: { onSearch: () => void; view: View; layout: Layout }) {
  return (
    <div className="flex h-11 items-center gap-3 border-b border-[var(--x-line)] bg-[var(--x-surface-sunk)] px-3">
      <div className="flex w-[196px] shrink-0 items-center gap-2 max-md:w-auto">
        <span className="grid h-6 w-6 place-items-center rounded-[5px] bg-[var(--x-chrome)] text-white"><BrandSymbol className="h-3.5 w-3.5" /></span>
        <span className="text-[12.5px] font-semibold">Ege Alüminyum</span>
        <ChevronDown size={13} className="text-[var(--x-faint)]" aria-hidden />
      </div>
      <span className="hidden text-[12px] text-[var(--x-muted)] md:block">{view === 'stock' ? 'Depo / A blok' : layout === 'board' ? 'Siparişler / Pano' : 'Siparişler / Liste'}</span>
      <button type="button" onClick={onSearch} className="ml-auto flex h-7 w-[220px] items-center gap-2 rounded-[var(--x-r-control)] bg-[var(--x-surface)] px-2.5 text-[12px] text-[var(--x-faint)] shadow-[inset_0_0_0_1px_var(--x-line)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--x-line-strong)] max-sm:w-auto">
        <Search size={13} aria-hidden /><span className="max-sm:hidden">Sipariş, müşteri, ekran</span><span className="ml-auto flex gap-0.5 max-sm:hidden"><kbd className="x-kbd">⌘</kbd><kbd className="x-kbd">K</kbd></span>
      </button>
      <span className="relative grid h-7 w-7 place-items-center text-[var(--x-muted)]"><Bell size={14} aria-hidden /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--x-bronze-fill)]" /></span>
      <Initials name="Selin Aydın" />
    </div>
  );
}

function Sidebar({ view, setView, counts }: { view: View; setView: (v: View) => void; counts: Record<View, number> }) {
  return (
    <nav aria-label="Örnek çalışma alanı menüsü" className="hidden flex-col border-r border-[var(--x-line)] bg-[var(--x-surface-sunk)] p-2 md:flex">
      <LayoutGroup id="pw-nav">
        {NAV.map(({ key, label, icon: Icon }) => {
          const active = key === view;
          return (
            <button key={key} type="button" onClick={() => setView(key)} aria-current={active ? 'page' : undefined} className={cn('relative flex h-8 items-center gap-2.5 rounded-[var(--x-r-control)] px-2.5 text-[12.5px] transition-colors duration-[120ms]', active ? 'font-medium text-[var(--x-ink)]' : 'text-[var(--x-muted)] hover:bg-[var(--x-surface-hover)] hover:text-[var(--x-ink)]')}>
              {active && <motion.span layoutId="pw-nav-active" transition={T.indicator} className="absolute inset-0 rounded-[var(--x-r-control)] bg-[var(--x-surface)] shadow-[0_1px_2px_rgb(20_26_28/0.08),0_0_0_1px_var(--x-line)]" />}
              {active && <motion.span layoutId="pw-nav-mark" transition={T.indicator} className="absolute -left-2 top-2 h-4 w-[2px] rounded-full bg-[var(--x-bronze-fill)]" />}
              <Icon size={14} strokeWidth={1.8} className="relative" aria-hidden />
              <span className="relative">{label}</span>
              <span className="x-num relative ml-auto text-[11px] text-[var(--x-faint)]">{counts[key]}</span>
            </button>
          );
        })}
      </LayoutGroup>
      <p className="mt-5 px-2.5 text-[11px] text-[var(--x-faint)]">Bu hafta</p>
      <div className="mt-1.5 space-y-2 px-2.5 text-[12px] text-[var(--x-muted)]">
        <p className="flex justify-between"><span>Sevk</span><span className="x-num text-[var(--x-ink-2)]">3</span></p>
        <p className="flex justify-between"><span>Montaj</span><span className="x-num text-[var(--x-ink-2)]">4</span></p>
        <p className="flex justify-between"><span>Tahsilat</span><span className="x-num text-[var(--x-ink-2)]">₺412.800</span></p>
      </div>
      <p className="mt-auto rounded-[var(--x-r-control)] px-2.5 py-2 text-[11px] leading-4 text-[var(--x-faint)]">Örnek veri. Tarayıcınızda çalışır, hiçbir yere gönderilmez.</p>
    </nav>
  );
}

function OrdersTable({ orders, openId, onOpen }: { orders: Order[]; openId: string | null; onOpen: (id: string) => void }) {
  return (
    <table className="w-full border-separate border-spacing-0 text-[12.5px]">
      <thead className="sticky top-0 z-[1] bg-[var(--x-surface)] text-[11px] text-[var(--x-muted)]">
        <tr className="[&>th]:border-b [&>th]:border-[var(--x-line)] [&>th]:py-2 [&>th]:text-left [&>th]:font-normal">
          <th className="w-[104px] pl-4 sm:pl-5">Sipariş</th>
          <th className="w-[30%]">Müşteri</th>
          <th className="max-lg:hidden">Ölçü (mm)</th>
          <th className="max-sm:hidden">Renk</th>
          <th className="max-sm:hidden">Termin</th>
          <th className="pr-4 sm:pr-5">Aşama</th>
        </tr>
      </thead>
      <motion.tbody layout>
        <AnimatePresence initial={false}>
          {orders.map((o) => (
            <motion.tr
              key={o.id}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={T.base}
              data-open={o.id === openId}
              onClick={() => onOpen(o.id)}
              className="x-row cursor-pointer [&>td]:border-b [&>td]:border-[var(--x-line)] [&>td]:py-2.5"
            >
              <td className="pl-4 sm:pl-5"><button type="button" onClick={(e) => { e.stopPropagation(); onOpen(o.id); }} className="x-mono text-[12px] text-[var(--x-bronze)] hover:underline">{o.id}</button></td>
              <td className="max-w-0 pr-3"><span className="block truncate font-medium">{o.customer}</span><span className="block truncate text-[11px] text-[var(--x-faint)]">{o.city} · {o.spec.motor ? 'Motorlu' : 'Manuel'}{o.spec.led ? ', LED' : ''}</span></td>
              <td className="x-num whitespace-nowrap text-[var(--x-ink-2)] max-lg:hidden">{fmt(o.spec.widthMm)} × {fmt(o.spec.projectionMm)}</td>
              <td className="whitespace-nowrap text-[var(--x-ink-2)] max-sm:hidden"><Swatch color={o.spec.color} /></td>
              <td className="whitespace-nowrap text-[var(--x-ink-2)] max-sm:hidden">{o.due}</td>
              <td className="whitespace-nowrap pr-4 sm:pr-5"><StageLabel stage={o.stage} /></td>
            </motion.tr>
          ))}
        </AnimatePresence>
      </motion.tbody>
    </table>
  );
}

// The column under the pointer wins, as on a Trello board; keyboard moves fall back to overlap.
const underPointer: CollisionDetection = (args) => { const hits = pointerWithin(args); return hits.length ? hits : rectIntersection(args); };

function Board({ orders, openId, onOpen, onMove }: { orders: Order[]; openId: string | null; onOpen: (id: string) => void; onMove: (id: string, to: StageKey) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }), useSensor(KeyboardSensor));
  const [dragging, setDragging] = useState<Order | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const from = dragging ? stageIndex(dragging.stage) : -1;
  const onStart = (e: DragStartEvent) => setDragging(orders.find((o) => o.id === e.active.id) ?? null);
  const onEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (!e.over) return;
    setDropped(String(e.active.id));
    onMove(String(e.active.id), e.over.id as StageKey);
    setTimeout(() => setDropped(null), 60);
  };
  return (
    <DndContext id="pw-board-dnd" sensors={sensors} collisionDetection={underPointer} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setDragging(null)} accessibility={{ screenReaderInstructions: { draggable: 'Taşımak için boşluk, sütun seçmek için oklar, bırakmak için boşluk.' } }}>
      <LayoutGroup id="pw-board">
        <div className="grid h-full min-w-[960px] grid-cols-6 gap-2 px-4 pb-4 sm:px-5">
          {STAGES.map((stage, i) => (
            <Column key={stage.key} stage={stage} state={!dragging ? 'idle' : i === from ? 'home' : Math.abs(i - from) === 1 ? 'allowed' : 'blocked'} count={orders.filter((o) => o.stage === stage.key).length}>
              {orders.filter((o) => o.stage === stage.key).map((o) => <Card key={o.id} order={o} open={openId === o.id} onOpen={onOpen} layout={dropped !== o.id} />)}
            </Column>
          ))}
        </div>
      </LayoutGroup>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {dragging && <CardFace order={dragging} lifted />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ stage, state, count, children }: { stage: (typeof STAGES)[number]; state: 'idle' | 'home' | 'allowed' | 'blocked'; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <section ref={setNodeRef} aria-label={stage.label} className={cn('flex min-h-0 flex-col rounded-[var(--x-r-panel)] bg-[var(--x-surface-sunk)] p-1.5 transition-[background-color,box-shadow,opacity] duration-150',
      state === 'allowed' && 'shadow-[inset_0_0_0_1px_var(--x-line-strong)]',
      state === 'allowed' && isOver && 'bg-[var(--x-bronze-soft)] shadow-[inset_0_0_0_1.5px_var(--x-bronze-fill)]',
      state === 'blocked' && 'opacity-45',
      state === 'blocked' && isOver && 'shadow-[inset_0_0_0_1.5px_var(--x-danger)]')}>
      <h3 className="flex items-center gap-1.5 px-1.5 py-1.5 text-[12px] font-medium" style={{ fontFamily: 'var(--font-sans)', fontStretch: '100%', letterSpacing: 0 }}><StageDot stage={stage.key} />{stage.label}<span className="x-num ml-auto text-[11px] font-normal text-[var(--x-faint)]">{count}</span></h3>
      <div className="flex-1 space-y-1.5">{children}</div>
    </section>
  );
}

function Card({ order, open, onOpen, layout }: { order: Order; open: boolean; onOpen: (id: string) => void; layout: boolean }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: order.id });
  return (
    <motion.div layoutId={layout ? `card-${order.id}` : undefined} transition={T.indicator} ref={setNodeRef} {...attributes} {...listeners} role="button" aria-label={`${order.id} ${order.customer}, taşı ya da aç`} onClick={() => onOpen(order.id)}
      onKeyDown={(e) => { listeners?.onKeyDown?.(e); if (e.key === 'Enter') onOpen(order.id); }}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      className="cursor-grab touch-none rounded-[var(--x-r-control)] active:cursor-grabbing">
      <CardFace order={order} open={open} />
    </motion.div>
  );
}

function CardFace({ order: o, open, lifted }: { order: Order; open?: boolean; lifted?: boolean }) {
  return (
    <div className={cn('block w-full rounded-[var(--x-r-control)] bg-[var(--x-surface)] p-2.5 text-left shadow-[0_1px_2px_rgb(20_26_28/0.06),0_0_0_1px_var(--x-line)] transition-shadow duration-[120ms] hover:shadow-[0_4px_12px_-4px_rgb(20_26_28/0.16),0_0_0_1px_var(--x-line-strong)]', open && 'shadow-[0_0_0_1.5px_var(--x-bronze-fill)]', lifted && 'w-[150px] rotate-[2.5deg] cursor-grabbing shadow-[0_18px_36px_-12px_rgb(20_26_28/0.4),0_0_0_1px_var(--x-line-strong)]')}>
      <span className="flex items-center justify-between text-[11px]"><span className="x-mono text-[var(--x-bronze)]">{o.id}</span><Initials name={o.owner} /></span>
      <span className="mt-1 block truncate text-[12.5px] font-medium">{o.customer}</span>
      <span className="x-num mt-0.5 block text-[11px] text-[var(--x-muted)]">{fmt(o.spec.widthMm)} × {fmt(o.spec.projectionMm)}</span>
      <span className="mt-2 flex items-center justify-between text-[11px] text-[var(--x-muted)]"><Swatch color={o.spec.color} withLabel={false} /><span>{o.due}</span></span>
    </div>
  );
}

const RACKS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'D4'];

function StockView() {
  const [picked, setPicked] = useState(3);
  const row = STOCK[picked];
  return (
    <div className="grid gap-4 px-4 pb-4 sm:px-5 lg:grid-cols-[1fr_220px]">
      <table className="w-full border-separate border-spacing-0 text-[12.5px]">
        <thead className="text-[11px] text-[var(--x-muted)]">
          <tr className="[&>th]:border-b [&>th]:border-[var(--x-line)] [&>th]:py-2 [&>th]:text-left [&>th]:font-normal">
            <th className="pl-2">Profil</th><th className="max-sm:hidden">Renk</th><th>Raf</th><th className="text-right">Serbest</th><th className="w-[30%] pl-4 max-sm:hidden">Doluluk</th>
          </tr>
        </thead>
        <tbody>
          {STOCK.map((s, i) => {
            const free = s.bars - s.reserved;
            return (
              <tr key={`${s.item}-${s.color}`} data-open={i === picked} onClick={() => setPicked(i)} className="x-row cursor-pointer [&>td]:border-b [&>td]:border-[var(--x-line)] [&>td]:py-2.5">
                <td className="pl-2"><button type="button" onClick={(e) => { e.stopPropagation(); setPicked(i); }} className="text-left"><span className="x-mono text-[var(--x-bronze)]">{ITEMS[s.item].code}</span> <span className="max-sm:hidden">{ITEMS[s.item].name}</span></button></td>
                <td className="max-sm:hidden"><Swatch color={s.color} /></td>
                <td className="x-mono text-[var(--x-ink-2)]">{s.rack}</td>
                <td className={cn('x-num text-right', free === 0 && 'text-[var(--x-danger)]')}>{free} / {s.bars}</td>
                <td className="pl-4 max-sm:hidden">
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-[var(--x-line)]">
                    <span style={{ width: `${(s.reserved / 32) * 100}%` }} className="bg-[var(--x-bronze-fill)]" />
                    <span style={{ width: `${(free / 32) * 100}%` }} className="bg-[var(--x-ink-2)]" />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="max-lg:hidden">
        <p className="pt-2 text-[11px] text-[var(--x-muted)]">A blok · raf planı</p>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {RACKS.map((r) => {
            const hit = STOCK.findIndex((s) => s.rack === r);
            const on = hit === picked;
            return (
              <button key={r} type="button" disabled={hit < 0} onClick={() => setPicked(hit)} aria-label={`Raf ${r}`} className={cn('x-mono relative aspect-square rounded-[4px] text-[10px] transition-colors duration-[120ms]', hit < 0 ? 'text-[var(--x-faint)] shadow-[inset_0_0_0_1px_var(--x-line)]' : 'bg-[var(--x-surface-sunk)] text-[var(--x-ink-2)] shadow-[inset_0_0_0_1px_var(--x-line-strong)] hover:bg-[var(--x-surface-hover)]')}>
                {on && <motion.span layoutId="rack-pick" transition={T.indicator} className="absolute inset-0 rounded-[4px] shadow-[inset_0_0_0_2px_var(--x-bronze-fill)]" />}
                <span className="relative">{r}</span>
              </button>
            );
          })}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={picked} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={T.base} className="mt-4 rounded-[var(--x-r-panel)] p-3 shadow-[var(--x-shadow-raise)]">
            <p className="x-mono text-[11px] text-[var(--x-bronze)]">{row.rack} · PKT-09{40 + picked}</p>
            <p className="mt-1 text-[12.5px] font-medium">{ITEMS[row.item].name}</p>
            <div className="mt-2 space-y-1 text-[11.5px]">
              <p className="flex justify-between"><span className="text-[var(--x-muted)]">Renk</span><Swatch color={row.color} /></p>
              <p className="flex justify-between"><span className="text-[var(--x-muted)]">Boy</span><span className="x-num">{fmt(ITEMS[row.item].stockMm)} mm</span></p>
              <p className="flex justify-between"><span className="text-[var(--x-muted)]">Rezerve</span><span className="x-num">{row.reserved} profil</span></p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

type Pick = { type: 'order'; id: string } | { type: 'view'; view: View };

function Palette({ orders, onClose, onPick }: { orders: Order[]; onClose: () => void; onPick: (pick: Pick) => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const results = useMemo(() => {
    const q = query.toLocaleLowerCase('tr');
    const views = NAV.filter((n) => n.label.toLocaleLowerCase('tr').includes(q)).map((n) => ({ pick: { type: 'view', view: n.key } as Pick, label: n.label, hint: 'Ekran', icon: n.icon }));
    const found = orders.filter((o) => `${o.id} ${o.customer} ${o.city} ${o.spec.color}`.toLocaleLowerCase('tr').includes(q)).map((o) => ({ pick: { type: 'order', id: o.id } as Pick, label: `${o.id}  ${o.customer}`, hint: STAGES[stageIndex(o.stage)].label, icon: ReceiptText }));
    return [...found, ...views].slice(0, 8);
  }, [query, orders]);
  useEffect(() => setActive(0), [query]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); onPick(results[active].pick); }
  };
  return (
    <motion.div className="absolute inset-0 z-40 flex items-start justify-center bg-[rgb(20_26_28/0.18)] px-4 pt-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={T.fast} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div role="dialog" aria-label="Komut paleti" onKeyDown={onKey} initial={{ y: -6, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: -4, scale: 0.99, opacity: 0 }} transition={T.base} className="w-full max-w-[520px] overflow-hidden rounded-[var(--x-r-panel)] bg-[var(--x-surface)] shadow-[var(--x-shadow-pop)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--x-line)] px-3.5">
          <Search size={15} className="text-[var(--x-faint)]" aria-hidden />
          <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sipariş no, müşteri, renk ya da ekran" aria-label="Ara" role="combobox" aria-expanded aria-controls="pw-palette-list" aria-activedescendant={results[active] ? `pw-opt-${active}` : undefined} className="h-11 flex-1 bg-transparent text-[13.5px] outline-none focus-visible:outline-none placeholder:text-[var(--x-faint)]" />
          <kbd className="x-kbd">Esc</kbd>
        </div>
        <ul id="pw-palette-list" role="listbox" className="max-h-[280px] overflow-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-[12.5px] text-[var(--x-muted)]">“{query}” için sonuç yok. Sipariş numarası ya da müşteri adıyla arayın.</li>}
          {results.map((r, i) => (
            <li key={r.label} id={`pw-opt-${i}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => onPick(r.pick)} className="relative flex cursor-pointer items-center gap-2.5 rounded-[var(--x-r-control)] px-2.5 py-2 text-[12.5px]">
              {i === active && <motion.span layoutId="pw-opt" transition={T.indicator} className="absolute inset-0 rounded-[var(--x-r-control)] bg-[var(--x-surface-hover)]" />}
              <r.icon size={14} className="relative text-[var(--x-muted)]" aria-hidden />
              <span className="relative flex-1 truncate">{r.label}</span>
              <span className="relative text-[11px] text-[var(--x-faint)]">{r.hint}</span>
              {i === active && <CornerDownLeft size={12} className="relative text-[var(--x-faint)]" aria-hidden />}
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}
