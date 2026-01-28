import LandingNav from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing-new/Footer';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <LandingNav />
      
      <main className="py-20 container mx-auto px-6 md:px-12 max-w-4xl">
        <h1 className="text-4xl font-black mb-8 text-text-light dark:text-text-dark">Gizlilik Politikası</h1>
        
        <div className="prose dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300">
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
      </main>
      
      <Footer />
    </div>
  );
}
