import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Rocket, Settings, BarChart3, Users, Package, CreditCard, Code2, HelpCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dokümantasyon | RenkFlow',
  description: 'RenkFlow kullanım kılavuzu, API dokümantasyonu ve entegrasyon rehberleri',
};

const gettingStarted = [
  { title: 'Hesap Oluşturma', desc: 'Kayıt olun ve işletmenizi tanımlayın', icon: Rocket },
  { title: 'İlk Siparişiniz', desc: 'Sipariş oluşturma ve takip etme adımları', icon: Package },
  { title: 'Ekip Yönetimi', desc: 'Kullanıcı rolleri ve yetkilendirme', icon: Users },
];

const docCategories = [
  {
    title: 'Sipariş Yönetimi',
    icon: Package,
    color: 'blue',
    topics: ['Sipariş oluşturma ve düzenleme', 'Durum takibi ve güncelleme', 'Toplu sipariş işlemleri', 'Sipariş geçmişi ve arama'],
  },
  {
    title: 'Müşteri Yönetimi',
    icon: Users,
    color: 'emerald',
    topics: ['Müşteri kaydı ve profil', 'İletişim geçmişi', 'Müşteri segmentasyonu', 'Toplu veri içe aktarma'],
  },
  {
    title: 'Raporlar & Analitik',
    icon: BarChart3,
    color: 'violet',
    topics: ['Dashboard özelleştirme', 'Gelir ve sipariş raporları', 'Dışa aktarma (PDF/Excel)', 'Özel rapor oluşturma'],
  },
  {
    title: 'Finans & Faturalama',
    icon: CreditCard,
    color: 'amber',
    topics: ['Fatura oluşturma', 'Ödeme takibi', 'Vergi ayarları', 'Gelir-gider analizi'],
  },
  {
    title: 'API Referansı',
    icon: Code2,
    color: 'rose',
    topics: ['REST API genel bakış', 'Kimlik doğrulama (Bearer Token)', 'Rate limiting politikası', 'Webhook yapılandırma'],
  },
  {
    title: 'Ayarlar & Yapılandırma',
    icon: Settings,
    color: 'slate',
    topics: ['İşletme profili', 'Bildirim tercihleri', 'E-posta şablonları', 'Entegrasyon ayarları'],
  },
];

const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
  blue:    { bg: 'border-blue-200 dark:border-blue-800',    text: 'text-blue-600 dark:text-blue-400',    iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
  emerald: { bg: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  violet:  { bg: 'border-violet-200 dark:border-violet-800',  text: 'text-violet-600 dark:text-violet-400',  iconBg: 'bg-violet-100 dark:bg-violet-900/30' },
  amber:   { bg: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-600 dark:text-amber-400',   iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
  rose:    { bg: 'border-rose-200 dark:border-rose-800',    text: 'text-rose-600 dark:text-rose-400',    iconBg: 'bg-rose-100 dark:bg-rose-900/30' },
  slate:   { bg: 'border-slate-200 dark:border-slate-700',   text: 'text-slate-600 dark:text-slate-400',   iconBg: 'bg-slate-100 dark:bg-slate-800' },
};

export default function DocsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-6">
          <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Dokümantasyon</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          RenkFlow&apos;u en verimli şekilde kullanmanız için kapsamlı kılavuzlar ve API referansı.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Hızlı Başlangıç</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {gettingStarted.map((item, i) => (
            <div key={item.title} className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-bold">
                  {i + 1}
                </span>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{item.title}</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Kılavuzlar</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docCategories.map((cat) => {
            const c = colorMap[cat.color];
            return (
              <div key={cat.title} className={`rounded-2xl border ${c.bg} bg-white dark:bg-slate-900 p-5 shadow-sm`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${c.iconBg}`}>
                    <cat.icon className={`w-5 h-5 ${c.text}`} />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{cat.title}</h3>
                </div>
                <ul className="space-y-1.5">
                  {cat.topics.map((topic) => (
                    <li key={topic} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-12">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex-shrink-0">
              <HelpCircle className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Yardıma mı ihtiyacınız var?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Dokümantasyonda aradığınızı bulamadıysanız, destek ekibimiz size yardımcı olmaktan memnuniyet duyar.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
              >
                Destek ile iletişime geçin
              </Link>
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
