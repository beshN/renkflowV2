'use client';

import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ReportsPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar title="Gelişmiş Raporlama" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
              <h3 className="font-medium text-slate-700">Aylık Üretim</h3>
            </div>
            <p className="text-3xl font-bold">1,245</p>
            <p className="text-sm text-emerald-600 mt-1">+15% geçen aya göre</p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 rounded-lg"><Activity className="w-5 h-5 text-rose-600" /></div>
              <h3 className="font-medium text-slate-700">Fire Oranı</h3>
            </div>
            <p className="text-3xl font-bold">3.2%</p>
            <p className="text-sm text-rose-600 mt-1">Hedefin 0.2% üzerinde</p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-sky-50 rounded-lg"><BarChart3 className="w-5 h-5 text-sky-600" /></div>
              <h3 className="font-medium text-slate-700">Teslimat Performansı</h3>
            </div>
            <p className="text-3xl font-bold">96%</p>
            <p className="text-sm text-sky-600 mt-1">Zamanında teslimat</p>
          </div>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 rounded-lg"><PieChart className="w-5 h-5 text-amber-600" /></div>
              <h3 className="font-medium text-slate-700">Kapasite Kullanımı</h3>
            </div>
            <p className="text-3xl font-bold">82%</p>
            <p className="text-sm text-slate-500 mt-1">Optimum aralıkta</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
             <BarChart3 className="w-12 h-12 text-slate-300 mb-4" />
             <h3 className="text-lg font-medium">Sipariş Trendleri</h3>
             <p className="text-slate-500 text-center max-w-sm mt-2">Detaylı sipariş ve ciro analizleri için grafik altyapısı bir sonraki güncellemede eklenecektir.</p>
             <Button variant="outline" className="mt-4">Raporu İndir (PDF)</Button>
          </div>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
             <PieChart className="w-12 h-12 text-slate-300 mb-4" />
             <h3 className="text-lg font-medium">Ürün Dağılımı</h3>
             <p className="text-slate-500 text-center max-w-sm mt-2">Hangi ürün gruplarının daha çok satıldığına dair pasta grafik görünümü.</p>
             <Button variant="outline" className="mt-4">Excel'e Aktar</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
