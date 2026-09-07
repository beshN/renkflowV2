'use client';

import { useEffect, useState } from 'react';
import { RFListView } from '@/components/shared/views/RFListView';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { Activity } from 'lucide-react';

export default function InventoryMovementsPage() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/inventory/movements')
      .then(r => r.json())
      .then(d => {
        if (d.success) setMovements(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const typeMap: Record<string, string> = {
    'IN': 'Giriş (IN)',
    'OUT': 'Çıkış (OUT)',
    'TRANSFER': 'Transfer',
    'REVERSAL': 'İptal / İade',
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar title="Stok Hareketleri" showSearch={false} />
      <main className="flex-1 p-4 md:p-8">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
          <RFListView
            data={movements}
            title="Hareket Geçmişi"
            description="Envanter üzerindeki tüm giriş, çıkış ve transfer işlemleri"
            icon={<Activity className="h-5 w-5 text-sky-500" />}
            isLoading={loading}
            columns={[
              { key: 'entry_number', label: 'Fiş No' },
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
                key: 'lines',
                label: 'Kalemler',
                render: (val: any[]) => {
                  if (!val || val.length === 0) return '-';
                  return (
                    <div className="text-xs space-y-1">
                      {val.map((l: any, i: number) => (
                        <div key={i}>
                          <span className="font-semibold">{l.item_name}</span> 
                          <span className="ml-1 text-muted-foreground">({l.quantity_delta > 0 ? '+'+l.quantity_delta : l.quantity_delta} {l.uom})</span>
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
