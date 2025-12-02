import Link from 'next/link';

export default function LandingFooter() {
  const footerSections = [
    {
      title: 'Ürün',
      links: ['Çözümler', 'Fiyatlandırma', 'Entegrasyonlar', 'Yol Haritası']
    },
    {
      title: 'Şirket',
      links: ['Hakkımızda', 'Kariyer', 'Blog', 'İletişim']
    },
    {
      title: 'Kaynaklar',
      links: ['Yardım Merkezi', 'API Dokümantasyonu', 'Sistem Durumu']
    }
  ];

  return (
    <footer className="bg-gray-50/50 dark:bg-gray-900/50 pt-24 pb-12 border-t border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-5 gap-12 mb-20">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                <path d="M2 7L12 12L22 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                <path d="M12 22V12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
              </svg>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">Renkflow</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              Ekibinizin en iyi işlerini güçlendiren görsel iş birliği aracı.
            </p>
            <div className="flex gap-4">
              {['twitter', 'linkedin', 'instagram'].map((social) => (
                <a key={social} href="#" className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-primary hover:text-white transition-all duration-300">
                  <span className="material-symbols-outlined text-lg">share</span>
                </a>
              ))}
            </div>
          </div>
          
          {/* Footer Links */}
          {footerSections.map((section, i) => (
            <div key={i}>
              <h4 className="font-bold text-lg mb-6 text-gray-900 dark:text-white">{section.title}</h4>
              <ul className="space-y-4 text-gray-600 dark:text-gray-400">
                {section.links.map((link, j) => (
                  <li key={j}>
                    <a href="#" className="hover:text-primary transition-colors block hover:translate-x-1 duration-200">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Renkflow A.Ş. Tüm hakları saklıdır.</p>
          <div className="flex gap-8">
            <Link href="/privacy" className="hover:text-primary transition-colors">Gizlilik Politikası</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Kullanım Koşulları</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
