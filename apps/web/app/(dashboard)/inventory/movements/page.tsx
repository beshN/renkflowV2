'use client';

import { useApiCollection } from '@/lib/hooks/useApiCollection';
import { RFListView } from '@/components/shared/views/RFListView';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { Activity } from 'lucide-react';
import Link from 'next/link';
import { movementSourceLabel, unitLabel, warehouseTypeLabel } from '@/lib/features/inventory/vocabulary';

/** Where a movement came from, with a link to the record when there is one to open. */
function sourceOf(m: any): { label: string; href?: string } {
  const label = movementSourceLabel(m.reference_type);
  const id = m.reference_id as string | null;
  switch (m.reference_type) {
    case 'work_order':
    case 'shipment':
    case 'rework':
      return { label: m.order_number ? `${label} · Sipariş ${m.order_number}` : label, href: m.reference_type === 'rework' ? undefined : id ? `/work-orders/${id}` : undefined };
    case 'cutting_plan':
      return { label: id ? `${label} ${id.slice(0, 8).toUpperCase()}` : label, href: id ? `/production?tab=cutting&cut=${id}` : undefined };
    case 'goods_receipt':
      return { label: m.receipt_number ? `${label} ${m.receipt_number}` : label, href: '/receipts' };
    case 'warehouse_count':
      return { label, href: '/warehouse' };
    case 'manual':
      return { label: m.submitted_by_name ? `${label} · ${m.submitted_by_name}` : label };
    default:
      return { label };
  }
}

export default function InventoryMovementsPage() {
  const {data:movements,loading,error,reload}=useApiCollection('/api/v1/inventory/movements','Stok hareketleri alınamadı.');

  const typeMap: Record<string, string> = {
    'MATERIAL_RECEIPT':'Malzeme kabulü',
    'MATERIAL_TRANSFER':'Malzeme transferi',
    'MANUFACTURE':'Üretim',
    'MATERIAL_ISSUE':'Malzeme çıkışı',
    'IN': 'Giriş (IN)',
    'OUT': 'Çıkış (OUT)',
    'TRANSFER': 'Transfer',
    'REVERSAL': 'İptal / İade',
    'STOCK_RECONCILIATION': 'Sayım farkı',
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar title="Stok hareketleri" showSearch={false} />
      <main className="flex-1 p-4 md:p-8">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
          <RFListView
            data={movements}
            title="Hareket geçmişi"
            description="Envanter üzerindeki tüm giriş, çıkış ve transfer işlemleri"
            icon={<Activity className="h-5 w-5 text-sky-500" />}
            isLoading={loading}
            error={error}
            onRetry={reload}
            columns={[
              { key: 'entry_number', label: 'Fiş no' },
              { 
                key: 'entry_type', 
                label: 'Tür',
                render: (val) => (
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    val === 'IN' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                    val === 'OUT' ? 'bg-rose-50 text-rose-700 ring-rose-600/20' :
                    'bg-slate-50 text-slate-700 ring-slate-600/20'
                  }`}>
                    {typeMap[val] || val}
                  </span>
                )
              },
              {
                key: 'reference_type',
                label: 'Kaynak',
                render: (_val, row: any) => {
                  const source = sourceOf(row);
                  return source.href ? <Link className="text-xs underline" href={source.href}>{source.label}</Link> : <span className="text-xs">{source.label}</span>;
                }
              },
              {
                key: 'lines',
                label: 'Kalemler',
                render: (val: any[]) => {
                  if (!val || val.length === 0) return '-';
                  return (
                    <div className="text-xs space-y-1">
                      {val.map((l: any, i: number) => (
                        <div key={i}>
                          <span className="font-semibold">{l.item_name}</span> 
                          <span className="ml-1 text-muted-foreground">({l.quantity_delta > 0 ? '+'+l.quantity_delta : l.quantity_delta} {unitLabel(l.uom)} · {[l.warehouse_name, warehouseTypeLabel(l.warehouse_type)].filter(Boolean).join(' · ')})</span>
                        </div>
                      ))}
                    </div>
                  );
                }
              },
              {
                key: 'created_at',
                label: 'Tarih',
                render: (val) => new Date(val).toLocaleString('tr-TR')
              }
            ]}
          />
        </div>
      </main>
    </div>
  );
}
