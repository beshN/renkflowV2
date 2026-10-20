'use client';

import { unitLabel } from '@/lib/features/inventory/vocabulary';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Boxes, ClipboardList, FileUp, Plus, ScanLine } from 'lucide-react';
import { PageHeader, StatusChip } from '@/components/kit';
import { StockHeatmap } from '@/components/inventory/StockHeatmap';
import { MovementDrawer } from '@/components/inventory/MovementDrawer';
import { RFListView, type RFColumn, type RFFilter } from '@/components/shared/views/RFListView';
import { cn } from '@/lib/utils';
import { StockThresholdPanel } from '@/components/inventory/StockThresholdPanel';

// ============================================
// Types
// ============================================

interface InventoryItem {
  id: string;
  item_id: string;
  sku: string;
  item_name: string;
  item_type: string;
  stock_uom: string;
  warehouse_name: string;
  on_hand_qty: string;
  reserved_qty: string;
  available_qty: string;
  updated_at: string;
  min_stock?: string;
}

// ============================================
// Item Type Labels
// ============================================

const ITEM_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  raw_material: { label: 'Ham Madde', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  finished_good: { label: 'Mamul', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
  reusable_remnant: { label: 'Artık (Kullanılabilir)', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  scrap: { label: 'Hurda', color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' },
  consumable: { label: 'Sarf Malzeme', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
};

// ============================================
// Page
// ============================================

export default function InventoryPage() {
  const {user}=useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timelineFor, setTimelineFor] = useState<{ id: string; name: string } | null>(null);

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(showCriticalOnly ? { lowStockOnly: 'true' } : {}),
        ...(filterValues.itemType ? { itemType: filterValues.itemType } : {}),
      });
      const res = await fetch(`/api/v1/inventory/balances?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Stok yüklenemedi');
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stok yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, showCriticalOnly, filterValues]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  // Stats
  const criticalCount = items.filter((item) => {
    const available = parseFloat(item.available_qty) || 0;
    const min = parseFloat(item.min_stock || '0') || 0;
    return min > 0 && available <= min;
  }).length;

  const stockByUnit = items.reduce<Record<string, number>>((totals, item) => {
    totals[item.stock_uom] = (totals[item.stock_uom] || 0) + (Number(item.on_hand_qty) || 0);
    return totals;
  }, {});
  const stockUnitSummary = Object.entries(stockByUnit).map(([unit, quantity]) =>
    quantity.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' ' + unit
  ).join(' · ') || '—';

  const filters: RFFilter[] = [
    {
      key: 'itemType',
      label: 'Malzeme Tipi',
      type: 'select',
      options: Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v.label })),
    },
  ];

  const columns: RFColumn<InventoryItem>[] = useMemo(() => [
    {
      key: 'sku',
      label: 'Malzeme',
      render: (sku, row) => (
        <div>
          <p className="text-xs font-mono text-muted-foreground">{sku}</p>
          <Link href={"/inventory/"+row.item_id} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-primary hover:underline">{row.item_name}</Link>

        </div>
      ),
    },
    {
      key: 'warehouse_name',
      label: 'Depo',
      render: (val) => (
        <span className="text-sm text-muted-foreground">{val || '—'}</span>
      ),
    },
    {
      key: 'on_hand_qty',
      label: 'Fiziksel Stok',
      align: 'right',
      render: (val, row) => (
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {parseFloat(val).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {unitLabel(row.stock_uom)}
        </span>
      ),
    },
    {
      key: 'reserved_qty',
      label: 'Ayrılan',
      align: 'right',
      render: (val, row) => (
        <span className={cn('text-sm tabular-nums', parseFloat(val) > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground')}>
          {parseFloat(val).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {unitLabel(row.stock_uom)}
        </span>
      ),
    },
    {
      key: 'available_qty',
      label: 'Kullanılabilir',
      align: 'right',
      render: (val, row) => {
        const available = parseFloat(val) || 0;
        const min = parseFloat(row.min_stock || '0') || 0;
        const isCritical = available <= min && min > 0;
        return (
          <div className="flex flex-col items-end gap-1">
            <span className={cn('text-sm font-bold tabular-nums', isCritical && 'text-rose-700 dark:text-rose-300')}>
              {available.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {unitLabel(row.stock_uom)}
            </span>
            {isCritical&&<StatusChip tone="danger" label="Kritik" icon={AlertTriangle}/>}<span className="text-xs text-muted-foreground">{min>0?`Alt sınır ${min.toLocaleString('tr-TR')} ${unitLabel(row.stock_uom)}`:''}</span>
          </div>
        );
      },
    },
  ], []);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <main className="flex-1 space-y-5 p-4 md:p-8">
        <PageHeader eyebrow="Profil & malzeme" title="Stok" hint="Profil metreyle, hurda kg ile takip edilir. Rezervasyon fiziksel stoğu değiştirmez. Satıra tıklayınca malzemenin hareketleri açılır."
          kpis={[
            { label: 'malzeme', value: error || isLoading ? '·' : new Set(items.map((i) => i.item_id)).size, icon: Boxes },
            { label: 'kritik', value: error ? '—' : criticalCount, icon: AlertTriangle, tone: criticalCount ? 'danger' : 'neutral' },
            { label: 'toplam', value: stockUnitSummary },
          ]}
          action={<>
            <Link href="/warehouse/scan" aria-label="QR / barkod okut" className="rf-icon-button grid h-9 w-9 place-items-center border border-border"><ScanLine size={16} /></Link>
            {user && ["owner","admin"].includes(user.role) && <>
              <Link href="/inventory/count-import" aria-label="Sayım listesi içe aktar" className="rf-icon-button grid h-9 w-9 place-items-center border border-border"><FileUp size={16} /></Link>
              <Link href="/inventory/opening-count" aria-label="Çubuk sayımı" className="rf-icon-button grid h-9 w-9 place-items-center border border-border"><ClipboardList size={16} /></Link>
              <Link href="/inventory/new" className="rf-primary-button h-9 px-3 text-xs"><Plus size={14} /> Malzeme</Link>
            </>}
          </>} />
        {error && <div role="alert" className="rf-alert text-sm">{error} <button type="button" onClick={loadInventory} className="ml-3 underline">Tekrar dene</button></div>}
        {user && ['owner', 'admin', 'office', 'accountant'].includes(user.role) && <StockThresholdPanel />}
        <details className="rf-panel"><summary className="cursor-pointer text-sm font-medium">Stok dağılımı</summary><div className="mt-3"><StockHeatmap /></div></details>
        {/* Critical Stock Alert */}
        {criticalCount > 0 && (
          <div
            className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 px-4 py-3 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-colors"
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
          >
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <p className="text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-400">{criticalCount} kritik</p>
            <button className="ml-auto text-xs text-rose-600 dark:text-rose-400 underline underline-offset-2">
              {showCriticalOnly ? 'Tümü' : 'Yalnız kritikler'}
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 sm:p-6 shadow-sm">
          <RFListView<InventoryItem>
            title="Depo bakiyeleri"
            data={items}
            onRowClick={(row) => setTimelineFor({ id: row.item_id, name: row.item_name })}
            columns={columns}
            filters={filters}
            isLoading={isLoading}
            totalCount={total}
            onSearch={(q) => setSearchQuery(q)}
            onFilterChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
            filterValues={filterValues}
            emptyState={{ title: error ? 'Stok verisi alınamadı' : 'Stok kaydı yok', description: '' }}
          />
        </div>
        <MovementDrawer item={timelineFor} onClose={() => setTimelineFor(null)} />
      </main>
    </div>
  );
}
