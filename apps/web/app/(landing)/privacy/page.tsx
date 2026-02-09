
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] dark:bg-slate-950 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_40%)]"
      />
      
      <main className="py-24 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 relative z-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
          Yasal
        </span>
        <h1 className="mt-6 text-4xl font-black mb-8 text-text-light dark:text-text-dark">Gizlilik Politikası</h1>
        
        <div className="prose dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300 bg-white/80 dark:bg-slate-900/70 rounded-3xl border border-slate-200/70 dark:border-slate-800 p-8 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.45)]">
          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">1. Bilgi Toplama</h2>
            <p className="leading-relaxed">
              Renkflow olarak, kullanıcılarımızın gizliliğine önem veriyoruz. Bu politika, hangi bilgileri topladığımızı ve nasıl kullandığımızı açık layar. Platformumuzu kullanırken, adınız, e-posta adresiniz, şirket bilgileriniz gibi kişisel bilgiler toplayabiliriz.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">2. Bilgi Kullanımı</h2>
            <p className="leading-relaxed">
              Topladığımız bilgiler yalnızca hizmet kalitesini artırmak ve size daha iyi bir deneyim sunmak için kullanılır. Verilerinizi asla üçüncü taraflarla paylaşmayız veya satmayız.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">3. Çerezler (Cookies)</h2>
            <p className="leading-relaxed">
              Web sitemizde kullanıcı deneyimini iyileştirmek için çerezler kullanıyoruz. Tarayıcı ayarlarınızdan çerezleri yönetebilir veya devre dışı bırakabilirsiniz.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">4. Veri Güvenliği</h2>
            <p className="leading-relaxed">
              Verileriniz endüstri standartlarında şifreleme ve güvenlik önlemleriyle korunur. SOC 2 Tip II sertifikamız ve GDPR uyumluluğumuz ile verilerinizin güvenliğini garanti ediyoruz.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">5. Kullanıcı Hakları</h2>
            <p className="leading-relaxed">
              KVKK ve GDPR kapsamında, verilerinize erişme, düzeltme, silme veya aktarma hakkına sahipsiniz. Bu haklarınızı kullanmak için bizimle iletişime geçebilirsiniz.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">6. Değişiklikler</h2>
            <p className="leading-relaxed">
              Bu gizlilik politikasını zaman zaman güncelleyebiliriz. Önemli değişiklikler olduğunda sizi bilgilendireceğiz.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-text-light dark:text-text-dark">7. İletişim</h2>
            <p className="leading-relaxed">
              Gizlilik politikamız hakkında sorularınız varsa, lütfen bizimle iletişime geçin:
              <br />
              <strong>Email:</strong> privacy@renkflow.com
              <br />
              <strong>Telefon:</strong> +90 (123) 456 78 90
            </p>
          </section>

          <p className="text-sm text-gray-500 dark:text-gray-400 mt-12">
            Son güncelleme: {new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="mt-12 rounded-3xl border border-slate-200/70 bg-white/80 p-8 text-center shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/70">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Sorunuz mu var?</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Gizlilik politikamız hakkında daha fazla bilgi almak için bizimle iletişime geçebilirsiniz.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href="mailto:privacy@renkflow.com"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              privacy@renkflow.com
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
