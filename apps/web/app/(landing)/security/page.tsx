import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Server, Eye, KeyRound, ShieldCheck, Bug, Database, Globe } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Güvenlik | RenkFlow',
  description: 'RenkFlow güvenlik politikası, veri koruma uygulamaları ve altyapı güvenliği',
};

const securityFeatures = [
  {
    icon: Lock,
    title: 'Uçtan Uca Şifreleme',
    desc: 'Tüm veriler aktarım sırasında TLS 1.3 ile, beklemede AES-256 ile şifrelenir. API anahtarları ve hassas veriler tek yönlü hash ile saklanır.',
  },
  {
    icon: KeyRound,
    title: 'Kimlik Doğrulama',
    desc: 'Güvenli oturum yönetimi, brute-force koruması için rate limiting, ve şifre politikası zorunluluğu ile hesap güvenliği sağlanır.',
  },
  {
    icon: Database,
    title: 'Veri İzolasyonu',
    desc: 'Her işletmenin verileri tenant bazlı izole edilir. Row Level Security (RLS) ile çapraz erişim veritabanı seviyesinde engellenir.',
  },
  {
    icon: Server,
    title: 'Altyapı Güvenliği',
    desc: 'Uygulama Cloud Run üzerinde çalışır. Veritabanı Cloud SQL PostgreSQL ile yönetilir ve otomatik yedekleme yapılır.',
  },
  {
    icon: Eye,
    title: 'Erişim Kontrolü',
    desc: 'Rol tabanlı yetkilendirme (RBAC) ile her kullanıcı sadece yetkili olduğu verilere erişebilir. Tüm erişimler loglanır.',
  },
  {
    icon: Globe,
    title: 'API Güvenliği',
    desc: 'Tüm API endpoint\'leri kimlik doğrulama gerektirir. Rate limiting, input validation ve CORS politikaları uygulanır.',
  },
];

const complianceItems = [
  { label: 'KVKK', desc: 'Kişisel Verilerin Korunması Kanunu uyumluluğu' },
  { label: 'GDPR', desc: 'Avrupa Birliği Genel Veri Koruma Tüzüğü uyumluluğu' },
  { label: 'SOC 2 Type II', desc: 'Güvenlik denetim sertifikası (planlanan)' },
];

export default function SecurityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 mb-6">
          <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Güvenlik</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          RenkFlow&apos;da güvenlik en üst önceliğimizdir. Verilerinizi korumak için endüstri standardı uygulamaları kullanıyoruz.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Güvenlik Uygulamalarımız</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {securityFeatures.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{feature.title}</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Uyumluluk</h2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="space-y-4">
            {complianceItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">{item.label}</span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Sorumlu Açıklama (Responsible Disclosure)</h2>
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex-shrink-0">
              <Bug className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Güvenlik Açığı Bildirimi</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                Platformumuzda bir güvenlik açığı keşfettiyseniz, lütfen aşağıdaki adrese bildirin. 
                Sorumlu açıklama ilkelerine uygun raporları 48 saat içinde yanıtlamayı taahhüt ediyoruz.
              </p>
              <a href="mailto:security@renkflow.com" className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400">
                security@renkflow.com
              </a>
            </div>
          </div>
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
