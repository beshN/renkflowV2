'use client';

import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { Scissors, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function CuttingOptimizerPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar title="Kesim Optimizasyonu (1D Cutting Stock)" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-sky-50 dark:bg-sky-900/20 rounded-full flex items-center justify-center">
            <Scissors className="w-8 h-8 text-sky-600" />
          </div>
          <h2 className="text-2xl font-semibold">Alüminyum Profil Kesim Optimizasyonu</h2>
          <p className="text-slate-500">
            RenkFlow'un 1D Cutting-Stock algoritması ile profillerinizi en düşük fire (scrap) oranına sahip olacak şekilde nasıl keseceğinizi hesaplayabilirsiniz.
            Bu modül bir sonraki aşamada (Faz 7) server-side optimizasyon motoru ile birlikte devreye alınacaktır.
          </p>
          <div className="pt-4">
            <Button variant="primary" disabled icon={<Zap className="w-4 h-4"/>}>
              Optimizasyon Motorunu Başlat
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
