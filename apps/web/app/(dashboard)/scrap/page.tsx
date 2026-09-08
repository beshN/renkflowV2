'use client';

import { useEffect, useState } from 'react';
import { RFListView } from '@/components/shared/views/RFListView';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { Trash2, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ScrapPage() {
  const [scrapRecords, setScrapRecords] = useState<Array<{
    id: string;
    item_name: string;
    length_m: number;
    weight_kg: number;
    created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Stub data for now, since API for scrap records needs to be built next
    setScrapRecords([
      { id: '1', item_name: 'A-Profil 60mm', length_m: 0.45, weight_kg: 0.8, created_at: new Date().toISOString() },
      { id: '2', item_name: 'B-Profil 40mm', length_m: 0.15, weight_kg: 0.2, created_at: new Date(Date.now() - 86400000).toISOString() }
    ]);
    setLoading(false);
  }, []);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar title="Hurda ve Fire Yönetimi" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 rounded-lg"><TrendingDown className="w-5 h-5 text-rose-600" /></div>
              <h3 className="font-medium text-slate-700">Aylık Toplam Hurda</h3>
            </div>
            <p className="text-3xl font-bold">145.5 kg</p>
            <p className="text-sm text-rose-600 mt-1">Geçen aya göre +12%</p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 rounded-lg"><Trash2 className="w-5 h-5 text-amber-600" /></div>
              <h3 className="font-medium text-slate-700">Geri Dönüştürülebilir</h3>
            </div>
            <p className="text-3xl font-bold">85.0 kg</p>
            <p className="text-sm text-slate-500 mt-1">Ergitmeye uygun temiz profil</p>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
          <RFListView
            data={scrapRecords}
            title="Fire ve Hurda Kayıtları"
            description="Üretim bantlarından çıkan profil fireleri"
            icon={<Trash2 className="h-5 w-5 text-rose-500" />}
            isLoading={loading}
            columns={[
              { key: 'item_name', label: 'Profil Cinsi' },
              { 
                key: 'length_m', 
                label: 'Uzunluk (m)',
                render: (val) => `${val} m`
              },
              { 
                key: 'weight_kg', 
                label: 'Ağırlık (kg)',
                render: (val) => `${val} kg`
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
