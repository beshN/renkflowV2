'use client';

import { useEffect, useState } from 'react';
import { RFListView } from '@/components/shared/views/RFListView';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { ShoppingCart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/context/ToastContext';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadOrders = () => {
    setLoading(true);
    fetch('/api/v1/purchase-orders')
      .then(r => r.json())
      .then(d => {
        if (d.success) setOrders(d.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const statusMap: Record<string, string> = {
    'draft': 'Taslak',
    'submitted': 'Gönderildi',
    'partially_received': 'Kısmi Kabul',
    'received': 'Tamamlandı',
    'cancelled': 'İptal',
  };

  const statusColors: Record<string, string> = {
    'draft': 'bg-slate-50 text-slate-700 ring-slate-600/20',
    'submitted': 'bg-sky-50 text-sky-700 ring-sky-600/20',
    'partially_received': 'bg-amber-50 text-amber-700 ring-amber-600/20',
    'received': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    'cancelled': 'bg-rose-50 text-rose-700 ring-rose-600/20',
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar 
        title="Satın Alma Siparişleri" 
        showSearch={true}
        action={
          <Button variant="primary" icon={<Plus className="w-4 h-4"/>}>
            Yeni Sipariş
          </Button>
        }
      />
      
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
          <RFListView
            data={orders}
            title="Satın Alma Siparişleri (PO)"
            description="Tedarikçilere geçilen siparişler ve mal kabul durumları"
            icon={<ShoppingCart className="h-5 w-5 text-sky-500" />}
            isLoading={loading}
            columns={[
              { key: 'purchase_order_number', label: 'Sipariş No' },
              { key: 'supplier_name', label: 'Tedarikçi' },
              { 
                key: 'status', 
                label: 'Durum',
                render: (val) => (
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusColors[val] || statusColors['draft']}`}>
                    {statusMap[val] || val}
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
                          <span className="ml-1 text-muted-foreground">({l.received_qty}/{l.ordered_qty} {l.uom})</span>
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
