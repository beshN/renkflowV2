'use client';

import { useEffect, useState } from 'react';
import { RFListView } from '@/components/shared/views/RFListView';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { Truck, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadShipments = () => {
    setLoading(true);
    fetch('/api/v1/shipments')
      .then(r => r.json())
      .then(d => {
        if (d.success) setShipments(d.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadShipments();
  }, []);

  const statusMap: Record<string, string> = {
    'draft': 'Hazırlanıyor',
    'ready': 'Sevkiyata Hazır',
    'picked_up': 'Kargoya Verildi',
    'in_transit': 'Yolda',
    'delivered': 'Teslim Edildi',
    'failed': 'Teslim Edilemedi',
    'returned': 'İade'
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar 
        title="Sevkiyat Yönetimi" 
        showSearch={true}
        action={
          <Button variant="primary" icon={<Plus className="w-4 h-4"/>}>
            Yeni Sevkiyat
          </Button>
        }
      />
      
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
          <RFListView
            data={shipments}
            title="Sevkiyat Kayıtları"
            description="Müşterilere gönderilen siparişler ve teslimat durumları"
            icon={<Truck className="h-5 w-5 text-indigo-500" />}
            isLoading={loading}
            columns={[
              { key: 'shipment_number', label: 'Sevkiyat No' },
              { key: 'customer_name', label: 'Müşteri' },
              { 
                key: 'status', 
                label: 'Durum',
                render: (val) => (
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    val === 'delivered' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 
                    val === 'in_transit' || val === 'picked_up' ? 'bg-sky-50 text-sky-700 ring-sky-600/20' : 
                    val === 'failed' || val === 'returned' ? 'bg-rose-50 text-rose-700 ring-rose-600/20' :
                    'bg-slate-50 text-slate-700 ring-slate-600/20'
                  }`}>
                    {statusMap[val] || val}
                  </span>
                )
              },
              { key: 'carrier', label: 'Kargo / Kurye' },
              {
                key: 'items',
                label: 'İçerik',
                render: (val: any[]) => {
                  if (!val || val.length === 0) return '-';
                  return (
                    <div className="text-xs space-y-1">
                      {val.map((l: any, i: number) => (
                        <div key={i}>
                          <span className="font-semibold">{l.product_name}</span> 
                          <span className="ml-1 text-muted-foreground">({l.quantity} Adet)</span>
                        </div>
                      ))}
                    </div>
                  );
                }
              },
              {
                key: 'created_at',
                label: 'Kayıt Tarihi',
                render: (val) => new Date(val).toLocaleString('tr-TR')
              }
            ]}
          />
        </div>
      </main>
    </div>
  );
}
