import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, Rocket, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Yol Haritası | RenkFlow',
  description: 'RenkFlow ürün yol haritası ve planlanan özellikler',
};

const quarters = [
  {
    label: 'Q1 2025',
    status: 'completed' as const,
    title: 'Temel Platform',
    items: [
      { text: 'Sipariş yönetim sistemi', done: true },
      { text: 'Müşteri portali', done: true },
      { text: 'Anlık bildirimler (WebSocket)', done: true },
      { text: 'Çoklu dil desteği (TR/EN)', done: true },
    ],
  },
  {
    label: 'Q2 2025',
    status: 'in-progress' as const,
    title: 'Analitik & Raporlama',
    items: [
      { text: 'Gelişmiş dashboard ve grafikler', done: true },
      { text: 'PDF/Excel rapor dışa aktarma', done: true },
      { text: 'Özelleştirilebilir rapor şablonları', done: false },
      { text: 'Tahminsel analitik (AI-destekli)', done: false },
    ],
  },
  {
    label: 'Q3 2025',
    status: 'planned' as const,
    title: 'Entegrasyonlar',
    items: [
      { text: 'E-ticaret platform entegrasyonları (Trendyol, Hepsiburada)', done: false },
      { text: 'Muhasebe yazılımı bağlantısı (Parasut, Logo)', done: false },
      { text: 'Kargo firması API entegrasyonları', done: false },
      { text: 'Webhook ve Zapier desteği', done: false },
    ],
  },
  {
    label: 'Q4 2025',
    status: 'planned' as const,
    title: 'Mobil & AI',
    items: [
      { text: 'iOS ve Android mobil uygulama', done: false },
      { text: 'AI sipariş tahmini ve stok optimizasyonu', done: false },
      { text: 'Sesli komut desteği', done: false },
      { text: 'Akıllı fiyatlandırma önerileri', done: false },
    ],
  },
];

const statusConfig = {
  completed: { label: 'Tamamlandı', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, border: 'border-emerald-200 dark:border-emerald-800' },
  'in-progress': { label: 'Devam Ediyor', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: Zap, border: 'border-blue-200 dark:border-blue-800' },
  planned: { label: 'Planlanıyor', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', icon: Clock, border: 'border-slate-200 dark:border-slate-700' },
};

export default function RoadmapPage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-100 dark:bg-sky-900/30 mb-6">
          <Rocket className="w-8 h-8 text-sky-600 dark:text-sky-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Ürün Yol Haritası</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          RenkFlow&apos;un gelişim planı ve yaklaşan özellikler. 
          Geri bildirimleriniz önceliklerimizi şekillendiriyor.
        </p>
      </div>

      <div className="space-y-8">
        {quarters.map((q) => {
          const cfg = statusConfig[q.status];
          const Icon = cfg.icon;
          return (
            <div key={q.label} className={`rounded-2xl border ${cfg.border} bg-white dark:bg-slate-900 p-6 shadow-sm`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <span className="text-sm font-bold text-slate-900 dark:text-white">{q.label}</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:ml-auto">{q.title}</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.items.map((item) => (
                  <li key={item.text} className="flex items-start gap-2.5 text-sm">
                    {item.done ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 mt-0.5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex-shrink-0" />
                    )}
                    <span className={item.done ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-12 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 p-8 text-center text-white">
        <h2 className="text-xl font-bold mb-2">Bir öneriniz mi var?</h2>
        <p className="text-white/80 mb-4 text-sm">
          Ürün yol haritamızı şekillendirmemize yardımcı olun. Önerilerinizi bizimle paylaşın.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors"
        >
          Öneri Gönderin
        </Link>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
