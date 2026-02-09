'use client';

import Link from 'next/link';

export const dynamic = 'force-dynamic';

const positions = [
  {
    id: '1',
    title: 'Senior Full-Stack Developer',
    department: 'Mühendislik',
    location: 'İstanbul / Uzaktan',
    type: 'Tam Zamanlı',
    summary: 'React, Next.js ve Node.js teknolojileri ile ürün geliştirme ekibimize katılın.',
    responsibilities: [
      'Ürün özelliklerini uçtan uca geliştirmek',
      'Performans ve ölçeklenebilirlik iyileştirmeleri yapmak',
      'Frontend ve backend ekipleriyle yakın çalışmak',
    ],
    requirements: [
      '5+ yıl full-stack tecrübe',
      'React ve Next.js deneyimi',
      'API tasarımı ve veri modelleme konusunda güçlü yetkinlik',
    ],
  },
  {
    id: '2',
    title: 'Product Designer',
    department: 'Tasarım',
    location: 'İstanbul / Uzaktan',
    type: 'Tam Zamanlı',
    summary: 'Kullanıcı deneyimini şekillendiren, yenilikçi tasarım çözümleri üretin.',
    responsibilities: [
      'Ürün akışlarını ve arayüzlerini tasarlamak',
      'Kullanıcı araştırması ve test süreçlerine katılmak',
      'Design system gelişimine katkı sağlamak',
    ],
    requirements: [
      '3+ yıl ürün tasarımı tecrübesi',
      'Figma ve prototipleme araçlarına hakimiyet',
      'Güçlü görsel ve etkileşim tasarımı bilgisi',
    ],
  },
  {
    id: '3',
    title: 'DevOps Engineer',
    department: 'Mühendislik',
    location: 'Uzaktan',
    type: 'Tam Zamanlı',
    summary: 'Cloud altyapımızı yönetin ve CI/CD süreçlerimizi optimize edin.',
    responsibilities: [
      'CI/CD süreçlerini iyileştirmek',
      'Bulut altyapısını yönetmek',
      'Güvenlik ve izleme sistemlerini kurmak',
    ],
    requirements: [
      'AWS/GCP deneyimi',
      'Docker ve Kubernetes bilgisi',
      'Infrastructure as Code yaklaşımına hakimiyet',
    ],
  },
  {
    id: '4',
    title: 'Customer Success Manager',
    department: 'Müşteri Başarısı',
    location: 'İstanbul',
    type: 'Tam Zamanlı',
    summary: 'Müşterilerimizin başarılı olmalarını sağlayın ve uzun vadeli ilişkiler kurun.',
    responsibilities: [
      'Müşteri onboarding süreçlerini yürütmek',
      'Düzenli müşteri iletişimini sürdürmek',
      'Müşteri ihtiyaçlarını ürün ekibine aktarmak',
    ],
    requirements: [
      '2+ yıl müşteri başarısı deneyimi',
      'Güçlü iletişim ve problem çözme becerisi',
      'B2B SaaS deneyimi tercih sebebi',
    ],
  },
  {
    id: '5',
    title: 'Content Marketing Specialist',
    department: 'Pazarlama',
    location: 'Uzaktan',
    type: 'Tam Zamanlı',
    summary: 'Blog yazıları, e-kitaplar ve sosyal medya içerikleri ile marka bilinirliğimizi artırın.',
    responsibilities: [
      'İçerik stratejisi oluşturmak',
      'Blog ve bülten içeriklerini üretmek',
      'Pazarlama kampanyalarını desteklemek',
    ],
    requirements: [
      '2+ yıl içerik pazarlaması tecrübesi',
      'SEO ve içerik optimizasyonu bilgisi',
      'Türkçe içerik üretiminde güçlü yetkinlik',
    ],
  },
];

export default function CareerDetailPage({ params }: { params: { id: string } }) {
  const position = positions.find((item) => item.id === params.id);

  if (!position) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] dark:bg-slate-950 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Pozisyon bulunamadı</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Aradığınız ilan mevcut değil. Kariyer sayfasına dönerek açık pozisyonları inceleyebilirsiniz.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/careers"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Kariyer Sayfasına Dön
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            >
              İletişime Geç
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] dark:bg-slate-950">
      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pb-24 pt-32">
        <Link href="/careers" className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          ← Kariyer sayfasına geri dön
        </Link>

        <header className="mt-6 space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            {position.department}
          </span>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{position.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>{position.location}</span>
            <span>•</span>
            <span>{position.type}</span>
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-300">{position.summary}</p>
        </header>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/70">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Sorumluluklar</h2>
            <ul className="mt-4 space-y-3 text-slate-600 dark:text-slate-400">
              {position.responsibilities.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-sky-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/70">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Aranan Nitelikler</h2>
            <ul className="mt-4 space-y-3 text-slate-600 dark:text-slate-400">
              {position.requirements.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200/70 bg-white/80 p-8 text-center shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/70">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Başvurmak ister misiniz?</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            CV&apos;nizi careers@renkflow.com adresine iletin, ekibimiz sizinle iletişime geçsin.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href={`mailto:careers@renkflow.com?subject=${encodeURIComponent(position.title)}%20Başvurusu`}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_-18px_rgba(14,165,233,0.7)] hover:opacity-90"
            >
              CV Gönder
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            >
              İletişime Geç
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
