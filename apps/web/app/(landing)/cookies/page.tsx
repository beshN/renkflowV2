import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Çerez Politikası | RenkFlow',
  description: 'RenkFlow çerez kullanım politikası',
};

export default function CookiesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Çerez Politikası</h1>
      
      <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
        <p className="text-slate-600 dark:text-slate-300">
          Son güncelleme: {new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">1. Çerez Nedir?</h2>
          <p className="text-slate-600 dark:text-slate-300">
            Çerezler, web sitelerinin tarayıcınıza yerleştirdiği küçük metin dosyalarıdır. 
            Sitemizin düzgün çalışması, güvenliğin sağlanması ve kullanıcı deneyiminin iyileştirilmesi için çerez kullanıyoruz.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">2. Kullandığımız Çerez Türleri</h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-300">
            <li><strong>Zorunlu Çerezler:</strong> Oturum yönetimi ve güvenlik için gereklidir.</li>
            <li><strong>Analitik Çerezler:</strong> Site kullanımını anlamamıza yardımcı olur (Google Analytics).</li>
            <li><strong>Tercih Çerezleri:</strong> Dil ve tema tercihlerinizi hatırlar.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">3. Çerez Yönetimi</h2>
          <p className="text-slate-600 dark:text-slate-300">
            Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilir veya silebilirsiniz. 
            Ancak bazı zorunlu çerezler olmadan sitemiz düzgün çalışmayabilir.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-4">4. İletişim</h2>
          <p className="text-slate-600 dark:text-slate-300">
            Çerez politikamız hakkında sorularınız için <a href="mailto:info@renkflow.com" className="text-sky-600 hover:text-sky-700 dark:text-sky-400">info@renkflow.com</a> adresine yazabilirsiniz.
          </p>
        </section>
      </div>
    </div>
  );
}
