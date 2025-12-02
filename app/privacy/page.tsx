import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <LandingNav />
      <main className="py-20 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <h1 className="text-4xl font-black mb-8">Gizlilik Politikası</h1>
        
        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Bilgi Toplama</h2>
            <p>Renkflow olarak, kullanıcılarımızın gizliliğine önem veriyoruz. Bu politika, hangi bilgileri topladığımızı ve nasıl kullandığımızı açıklar.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Bilgi Kullanımı</h2>
            <p>Topladığımız bilgiler yalnızca hizmet kalitesini artırmak ve size daha iyi bir deneyim sunmak için kullanılır.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Veri Güvenliği</h2>
            <p>Verileriniz endüstri standartlarında şifreleme ve güvenlik önlemleriyle korunur.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. İletişim</h2>
            <p>Gizlilik politikamız hakkında sorularınız varsa, lütfen bizimle iletişime geçin: destek@renkflow.com</p>
          </section>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
