import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Newspaper, Mail, Calendar, ExternalLink, Image as ImageIcon, FileText, Palette } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Basın Kiti | RenkFlow',
  description: 'RenkFlow basın kiti, medya kaynakları ve iletişim bilgileri',
};

const pressReleases = [
  {
    date: '2025-05-15',
    title: 'RenkFlow v2.0: Yeni Nesil Matbaa Yönetim Platformu',
    summary: 'Tamamen yeniden tasarlanan arayüz, gelişmiş analitik ve AI destekli sipariş tahmini ile RenkFlow v2.0 yayınlandı.',
  },
  {
    date: '2025-03-01',
    title: 'RenkFlow, Türkiye Matbaa Sektörünü Dijitalleştiriyor',
    summary: 'Matbaa ve baskı işletmeleri için geliştirilen RenkFlow, sipariş takibi ve üretim yönetimini tek platformda birleştiriyor.',
  },
  {
    date: '2024-11-20',
    title: 'RenkFlow Beta Programı Başladı',
    summary: 'Erken erişim programımız kapsamında 50+ matbaa işletmesi platformu test etmeye başladı.',
  },
];

const brandAssets = [
  { label: 'Logo (PNG)', desc: 'Şeffaf arka plan, yüksek çözünürlük', icon: ImageIcon },
  { label: 'Logo (SVG)', desc: 'Vektör format, ölçeklenebilir', icon: Palette },
  { label: 'Marka Kılavuzu', desc: 'Renkler, tipografi ve kullanım kuralları', icon: FileText },
];

export default function PressPage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 mb-6">
          <Newspaper className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Basın Kiti</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          RenkFlow hakkında medya kaynakları, basın bültenleri ve marka varlıkları.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Hakkımızda</h2>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            RenkFlow, matbaa ve baskı sektörüne özel geliştirilmiş bulut tabanlı bir iş yönetim platformudur.
            Sipariş takibi, üretim planlama, müşteri yönetimi ve finansal analiz araçlarını tek bir çatı altında sunar.
            Türkiye&apos;deki matbaa işletmelerinin dijital dönüşümünü hızlandırmayı hedeflemektedir.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">Kuruluş: 2024</span>
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">Merkez: İstanbul, Türkiye</span>
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">Sektör: SaaS / Matbaa</span>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Basın Bültenleri</h2>
        <div className="space-y-4">
          {pressReleases.map((pr) => (
            <div key={pr.date} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(pr.date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{pr.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">{pr.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Marka Varlıkları</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {brandAssets.map((asset) => (
            <div key={asset.label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 mb-3">
                <asset.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{asset.label}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{asset.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
          Marka varlıklarını indirmek için <a href="mailto:info@renkflow.com" className="text-sky-600 hover:text-sky-700 dark:text-sky-400">info@renkflow.com</a> adresinden talepte bulunabilirsiniz.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Medya İletişim</h2>
        <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex-shrink-0">
              <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Basın ve Medya İlişkileri</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Röportaj talepleri, basın bülteni istekleri ve diğer medya sorularınız için:
              </p>
              <a href="mailto:info@renkflow.com" className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400">
                info@renkflow.com <ExternalLink className="w-3.5 h-3.5" />
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
