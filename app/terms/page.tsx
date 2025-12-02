import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

export default function Terms() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <LandingNav />
      <main className="py-20 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <h1 className="text-4xl font-black mb-8">Kullanım Koşulları</h1>
        
        <div className="prose dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold mb-4"> 1. Hizmet Kullanımı</h2>
            <p>Renkflow hizmetlerini kullanarak bu kullanım koşullarını kabul etmiş olursunuz.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Kullanıcı Sorumlulukları</h2>
            <p>Kullanıcılar, platformu kötüye kullanmamayı ve diğer kullanıcılara saygılı olmayı taahhüt eder.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Fikri Mülkiyet</h2>
            <p>Tüm içerik ve yazılımlar Renkflow A.Ş.'nin mülkiyetindedir.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Değişiklikler</h2>
            <p>Bu koşullar zaman zaman güncellenebilir. Önemli değişiklikler size bildirilecektir.</p>
          </section>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
