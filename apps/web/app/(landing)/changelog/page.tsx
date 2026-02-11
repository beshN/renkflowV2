import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Bug, Wrench, Rocket, Tag } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Değişiklik Günlüğü | RenkFlow',
  description: 'RenkFlow sürüm notları, yeni özellikler ve hata düzeltmeleri',
};

type ChangeType = 'feature' | 'fix' | 'improvement';

interface ChangeItem {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  title: string;
  changes: ChangeItem[];
}

const typeConfig: Record<ChangeType, { label: string; bg: string; text: string; icon: typeof Sparkles }> = {
  feature:     { label: 'Yeni',       bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: Sparkles },
  fix:         { label: 'Düzeltme',   bg: 'bg-red-100 dark:bg-red-900/30',         text: 'text-red-700 dark:text-red-400',         icon: Bug },
  improvement: { label: 'İyileştirme', bg: 'bg-blue-100 dark:bg-blue-900/30',       text: 'text-blue-700 dark:text-blue-400',       icon: Wrench },
};

const releases: Release[] = [
  {
    version: '2.1.0',
    date: '2025-06-01',
    title: 'Analitik & Raporlama Güncellemesi',
    changes: [
      { type: 'feature', text: 'Gelişmiş dashboard grafikleri — alan, çubuk ve pasta grafik desteği' },
      { type: 'feature', text: 'PDF ve Excel formatında rapor dışa aktarma' },
      { type: 'feature', text: 'Sistem durumu sayfası — servis bazlı uptime takibi' },
      { type: 'improvement', text: 'Grafik bileşenlerinde SSR uyumluluğu (SafeResponsiveContainer)' },
      { type: 'improvement', text: 'Footer newsletter formu artık backend API ile entegre' },
      { type: 'fix', text: 'Recharts width(-1)/height(-1) konsol hataları giderildi' },
      { type: 'fix', text: 'Merge conflict kaynaklı export API derleme hatası düzeltildi' },
    ],
  },
  {
    version: '2.0.0',
    date: '2025-05-15',
    title: 'RenkFlow v2 — Büyük Güncelleme',
    changes: [
      { type: 'feature', text: 'Tamamen yeniden tasarlanan modern arayüz (Tailwind CSS + Framer Motion)' },
      { type: 'feature', text: 'Çoklu dil desteği — Türkçe, İngilizce, Arapça (RTL dahil)' },
      { type: 'feature', text: 'Gerçek zamanlı bildirimler (WebSocket)' },
      { type: 'feature', text: 'Rol tabanlı yetkilendirme (RBAC) — Admin, Yönetici, Operatör' },
      { type: 'feature', text: 'SSO ve SAML/OIDC entegrasyonu' },
      { type: 'improvement', text: 'Next.js App Router mimarisine geçiş' },
      { type: 'improvement', text: 'Veritabanı Drizzle ORM ile yeniden yapılandırıldı' },
      { type: 'fix', text: 'Oturum zaman aşımı tutarsızlıkları giderildi' },
    ],
  },
  {
    version: '1.5.0',
    date: '2025-03-01',
    title: 'Müşteri Yönetimi & Faturalama',
    changes: [
      { type: 'feature', text: 'Müşteri profil sayfası — iletişim geçmişi ve sipariş özeti' },
      { type: 'feature', text: 'Otomatik fatura oluşturma ve PDF indirme' },
      { type: 'feature', text: 'Toplu sipariş içe aktarma (CSV/Excel)' },
      { type: 'improvement', text: 'Sipariş listeleme performansı 3x iyileştirildi' },
      { type: 'improvement', text: 'Mobil responsive düzenlemeler' },
      { type: 'fix', text: 'Sipariş durumu güncellendiğinde bildirim gönderilmeme hatası' },
    ],
  },
  {
    version: '1.0.0',
    date: '2024-11-20',
    title: 'İlk Sürüm — Beta',
    changes: [
      { type: 'feature', text: 'Sipariş oluşturma, düzenleme ve durum takibi' },
      { type: 'feature', text: 'Müşteri kayıt ve yönetim sistemi' },
      { type: 'feature', text: 'Temel dashboard ve sipariş istatistikleri' },
      { type: 'feature', text: 'E-posta bildirim sistemi' },
      { type: 'feature', text: 'Güvenli kimlik doğrulama (NextAuth.js)' },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-6">
          <Rocket className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Değişiklik Günlüğü</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          RenkFlow&apos;un tüm sürüm notları, yeni özellikler ve hata düzeltmeleri.
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />

        <div className="space-y-10">
          {releases.map((release) => (
            <div key={release.version} className="relative pl-12">
              <div className="absolute left-0 top-1 flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 border-4 border-white dark:border-slate-950 z-10">
                <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold">
                    v{release.version}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(release.date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 sm:ml-auto">{release.title}</span>
                </div>

                <ul className="space-y-2">
                  {release.changes.map((change, i) => {
                    const cfg = typeConfig[change.type];
                    const Icon = cfg.icon;
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 mt-0.5 ${cfg.bg} ${cfg.text}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">{change.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 text-center">
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
