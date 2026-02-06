import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Activity, CheckCircle2, AlertTriangle, Server, Database, Globe, Mail, Wifi, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sistem Durumu | RenkFlow',
  description: 'RenkFlow servis durumu, uptime bilgisi ve olay geçmişi',
};

const services = [
  { name: 'Web Uygulaması', desc: 'Ana uygulama ve landing sayfaları', icon: Globe, status: 'operational' as const, uptime: '99.98%' },
  { name: 'API Servisleri', desc: 'REST API ve webhook endpoint\'leri', icon: Server, status: 'operational' as const, uptime: '99.95%' },
  { name: 'Veritabanı', desc: 'PostgreSQL veri katmanı', icon: Database, status: 'operational' as const, uptime: '99.99%' },
  { name: 'Kimlik Doğrulama', desc: 'Oturum ve yetkilendirme servisi', icon: Shield, status: 'operational' as const, uptime: '99.97%' },
  { name: 'E-posta Servisi', desc: 'Bildirim ve hoş geldin e-postaları', icon: Mail, status: 'operational' as const, uptime: '99.90%' },
  { name: 'WebSocket (Gerçek Zamanlı)', desc: 'Anlık bildirimler ve canlı güncellemeler', icon: Wifi, status: 'operational' as const, uptime: '99.92%' },
];

const incidents = [
  {
    date: '2025-05-10',
    title: 'E-posta servisi gecikmesi',
    desc: 'E-posta gönderimlerinde 15 dakikalık gecikme yaşandı. Sorun üçüncü parti sağlayıcıdan kaynaklanıyordu ve çözüldü.',
    severity: 'minor' as const,
  },
  {
    date: '2025-04-22',
    title: 'Planlı bakım — Veritabanı yükseltme',
    desc: 'PostgreSQL 16 sürümüne yükseltme yapıldı. 5 dakikalık planlı kesinti gerçekleşti.',
    severity: 'maintenance' as const,
  },
  {
    date: '2025-03-15',
    title: 'API yanıt süresi artışı',
    desc: 'Yoğun trafik nedeniyle API yanıt süreleri geçici olarak arttı. Ölçeklendirme ile çözüldü.',
    severity: 'minor' as const,
  },
];

const statusConfig = {
  operational: { label: 'Çalışıyor', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', icon: CheckCircle2 },
  degraded: { label: 'Yavaşlama', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', icon: AlertTriangle },
  outage: { label: 'Kesinti', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', icon: AlertTriangle },
};

const severityConfig = {
  minor: { label: 'Küçük Olay', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  major: { label: 'Büyük Olay', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  maintenance: { label: 'Planlı Bakım', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
};

export default function StatusPage() {
  const allOperational = services.every((s) => s.status === 'operational');

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 mb-6">
          <Activity className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Sistem Durumu</h1>
        {allOperational && (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Tüm sistemler sorunsuz çalışıyor
          </div>
        )}
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Servis Durumları</h2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {services.map((service) => {
            const cfg = statusConfig[service.status];
            return (
              <div key={service.name} className="flex items-center gap-4 p-4">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                  <service.icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-900 dark:text-white">{service.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{service.desc}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.bg}`} />
                    {cfg.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Uptime: {service.uptime}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Son 90 Gün — Uptime</h2>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex gap-[2px] h-8 items-end">
            {Array.from({ length: 90 }, (_, i) => {
              const isIncident = i === 25 || i === 48;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${isIncident ? 'bg-amber-400 dark:bg-amber-500' : 'bg-emerald-400 dark:bg-emerald-500'}`}
                  style={{ height: isIncident ? '60%' : '100%' }}
                  title={isIncident ? 'Küçük olay' : 'Sorunsuz'}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400">
            <span>90 gün önce</span>
            <span>Bugün</span>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Olay Geçmişi</h2>
        <div className="space-y-3">
          {incidents.map((incident) => {
            const sev = severityConfig[incident.severity];
            return (
              <div key={incident.date} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(incident.date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sev.bg} ${sev.color}`}>
                    {sev.label}
                  </span>
                </div>
                <h3 className="font-medium text-sm text-slate-900 dark:text-white">{incident.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{incident.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-10">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 p-6 text-center text-white">
          <h2 className="text-lg font-bold mb-1">Durum bildirimleri alın</h2>
          <p className="text-white/80 text-sm mb-3">Herhangi bir kesinti durumunda anında bilgilendirilmek için abone olun.</p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-emerald-600 text-sm font-semibold hover:bg-emerald-50 transition-colors"
          >
            Bildirim Aboneliği
          </Link>
        </div>
      </section>

      <div className="text-center">
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
