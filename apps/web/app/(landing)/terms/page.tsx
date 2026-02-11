
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] dark:bg-slate-950 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(184,116,68,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_40%)]"
      />
      
      <main className="py-24 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 relative z-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
          Yasal
        </span>
        <h1 className="mt-6 text-4xl font-black mb-8 text-text-light dark:text-text-dark">Kullanım Koşulları</h1>
        
        <div className="prose dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300 bg-white/80 dark:bg-slate-900/70 rounded-3xl border border-slate-200/70 dark:border-slate-800 p-8 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.45)]">
          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">1. Hizmet Kullanımı</h2>
            <p className="leading-relaxed">
              Renkflow hizmetlerini kullanarak bu kullanım koşullarını kabul etmiş olursunuz. Platformumuzu yasalara uygun ve etik kurallara saygılı bir şekilde kullanmanız gerekmektedir.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">2. Kullanıcı Sorumlulukları</h2>
            <p className="leading-relaxed">
              Kullanıcılar, platformu kötüye kullanmamayı ve diğer kullanıcılara saygılı olmayı taahhüt eder. Hesap bilgilerinizin güvenliğinden siz sorumlusunuz.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">3. Fikri Mülkiyet</h2>
            <p className="leading-relaxed">
              Tüm içerik ve yazılımlar Renkflow A.Ş.&apos;nin mülkiyetindedir. Platform üzerindeki tüm ticari markalar, logolar ve içerikler telif hakkı ile korunmaktadır.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">4. Hizmet Kesintileri</h2>
            <p className="leading-relaxed">
              Bakım, güncelleme veya teknik sorunlar nedeniyle hizmette geçici kesintiler olabilir. Bu durumlarda kullanıcıları önceden bilgilendirmeye çalışırız.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">5 Ödeme ve İptal</h2>
            <p className="leading-relaxed">
              Ücretli planlar için ödeme koşulları ve iptal politikası fiyatlandırma sayfamızda detaylı olarak açıklanmıştır. İptal taleplerinde 30 günlük para iade garantisi sunuyoruz.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">6. Sorumluluk Sınırlaması</h2>
            <p className="leading-relaxed">
              Renkflow, hizmetin kullanımından kaynaklanan doğrudan veya dolaylı zararlardan sorumlu tutulamaz. Platform &quot;olduğu gibi&quot; sunulmaktadır.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">7. Değişiklikler</h2>
            <p className="leading-relaxed">
              Bu koşullar zaman zaman güncellenebilir. Önemli değişiklikler size e-posta yoluyla bildirilecektir. Değişikliklerden sonra platformu kullanmaya devam etmeniz yeni koşulları kabul ettiğiniz anlamına gelir.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">8. İletişim</h2>
            <p className="leading-relaxed">
              Kullanım koşulları hakkında sorularınız için:
              <br />
              <strong>Email:</strong> legal@renkflow.com
              <br />
              <strong>Adres:</strong> Renkflow A.Ş., İstanbul, Türkiye
            </p>
          </section>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-12">
            Son güncelleme: {new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="mt-12 rounded-3xl border border-slate-200/70 bg-white/80 p-8 text-center shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/70">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Koşullar hakkında sorunuz mu var?</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Kullanım koşullarıyla ilgili detaylar için bizimle iletişime geçebilirsiniz.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href="mailto:legal@renkflow.com"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              legal@renkflow.com
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
            >
              İletişime Geç
            </Link>
          </div>
        </div>
      </main>
      
      
    </div>
  );
}
