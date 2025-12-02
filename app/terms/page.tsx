import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

export default function Terms() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <LandingNav />
      
      <main className="py-20 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <h1 className="text-4xl font-black mb-8 text-text-light dark:text-text-dark">Kullanım Koşulları</h1>
        
        <div className="prose dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300">
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
      </main>
      
      <LandingFooter />
    </div>
  );
}
