'use client';

import { unitLabel } from '@/lib/features/inventory/vocabulary';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, AlertTriangle, TrendingDown, Boxes, ArrowUpDown } from 'lucide-react';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { RFListView, type RFColumn, type RFFilter } from '@/components/shared/views/RFListView';
import { cn } from '@/lib/utils';

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
// Stock Level Bar
// ============================================

function StockBar({ onHand, reserved, min }: { onHand: number; reserved: number; min: number }) {
  const available = onHand - reserved;
  const max = Math.max(onHand, min * 2, 1);
  const availablePercent = Math.max(0, available / max) * 100;
  const reservedPercent = (reserved / max) * 100;
  const isCritical = min > 0 && available <= min;

  return (
    <div className="w-24">
      <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden flex">
        <div
          className={cn('h-full rounded-full transition-all', isCritical ? 'bg-rose-500' : 'bg-emerald-500')}
          style={{ width: `${Math.min(availablePercent, 100)}%` }}
        />
        {reserved > 0 && (
          <div className="h-full bg-amber-400" style={{ width: `${Math.min(reservedPercent, 100)}%` }} />
        )}
      </div>
    </div>
  );
}

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
      label: 'SKU / Malzeme',
      render: (sku, row) => (
        <div>
          <p className="text-xs font-mono text-muted-foreground">{sku}</p>
          <Link href={"/inventory/"+row.item_id} className="text-sm font-semibold text-sky-700 hover:underline">{row.item_name}</Link>
          <span className={cn('inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium', ITEM_TYPE_LABELS[row.item_type]?.color || 'bg-neutral-100 text-neutral-600')}>
            {ITEM_TYPE_LABELS[row.item_type]?.label || row.item_type}
          </span>
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
      label: 'Rezerve',
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
          <div className="flex items-center gap-2 justify-end">
            {isCritical && <AlertTriangle size={13} className="text-rose-500 flex-shrink-0" />}
            <span className={cn('text-sm font-bold tabular-nums', isCritical ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
              {available.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {unitLabel(row.stock_uom)}
            </span>
          </div>
        );
      },
    },
  ], []);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar title="Profil & malzeme stoğu" showSearch={false} action={user && ["owner","admin"].includes(user.role)?<Link href="/inventory/new" className="rf-primary-button">Yeni malzeme</Link>:undefined} />

      <main className="flex-1 p-4 md:p-8">
        <div className="rf-panel mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="rf-eyebrow">FİZİKSEL STOK BAĞLANTISI</p><h2 className="mt-2 text-lg font-semibold">Malzemeyi raftan üretime takip edin.</h2><p className="mt-2 text-sm text-muted-foreground">Lot ve raf etiketleriyle konum, transfer ve sayım işlemleri.</p></div><div className="flex flex-wrap gap-2"><Link href="/warehouse" className="rf-secondary-button">Depo & raflar</Link><Link href="/warehouse/scan" className="rf-primary-button">QR / barkod okut</Link></div></div>
        {error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error} <button type="button" onClick={loadInventory} className="ml-3 underline">Tekrar dene</button></div>}
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {[
            {
              label: 'Malzeme (bu görünüm)',
              value: error || isLoading ? '—' : new Set(items.map(i=>i.item_id)).size,
              icon: Boxes,
              color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
            },
            {
              label: 'Kritik depo bakiyesi',
              value: error ? '—' : criticalCount,
              icon: AlertTriangle,
              color: criticalCount > 0 ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/20' : 'text-neutral-600 bg-neutral-50 dark:bg-neutral-900',
            },
            {
              label: 'Stok Kalemleri (Bu Sayfa)',
              value: error ? '—' : items.length,
              icon: Package,
              color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
            },
            {
              label: 'Fiziksel stok (birimine göre)',
              value: stockUnitSummary,
              icon: ArrowUpDown,
              color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 flex items-center gap-4 shadow-sm">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="text-xl font-bold text-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Critical Stock Alert */}
        {criticalCount > 0 && (
          <div
            className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 px-4 py-3 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-colors"
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
          >
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              {criticalCount} malzeme minimum stok seviyesinin altında!
            </p>
            <button className="ml-auto text-xs text-rose-600 dark:text-rose-400 underline underline-offset-2">
              {showCriticalOnly ? 'Tümünü göster' : 'Sadece kritikleri göster'}
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
          <RFListView<InventoryItem>
            title="Depo bakiyeleri"
            subtitle="Profil metreyle, hurda kg ile takip edilir. Rezervasyon fiziksel stoğu değiştirmez."
            data={items}
            columns={columns}
            filters={filters}
            isLoading={isLoading}
            totalCount={total}
            onSearch={(q) => setSearchQuery(q)}
            onFilterChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
            filterValues={filterValues}
            emptyState={{
              title: error ? 'Stok verisi yüklenemedi' : 'Stok kaydı bulunamadı',
              description: error ? 'Depo bakiyeleri alınamadı. Stok kurulumu ve veritabanı bağlantısı kontrol edilmeli.' : 'Envanter kalemleri ve depolar tanımlandığında stok hareketleri burada görünecek.',
            }}
          />
        </div>
      </main>
    </div>
  );
}
