import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-[#0F172A] flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-lg">factory</span>
          </div>
          <span className="text-xl font-bold text-[#0F172A]">RenkFlow</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <Link href="#features" className="hover:text-[#0F172A] transition-colors">Özellikler</Link>
          <Link href="#how-it-works" className="hover:text-[#0F172A] transition-colors">Nasıl Çalışır?</Link>
          <Link href="#faq" className="hover:text-[#0F172A] transition-colors">SSS</Link>
          <Link href="#contact" className="hover:text-[#0F172A] transition-colors">İletişim</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-[#0F172A] transition-colors">
            Giriş Yap
          </Link>
          <Link href="/login">
            <button className="bg-[#1E293B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0F172A] transition-all hover:shadow-lg active:scale-95">
              Demo Talep Et
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-32 px-4 sm:px-6 lg:px-8 text-center max-w-7xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-xs font-medium text-blue-700 mb-8 border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Yeni: Gelişmiş Raporlama Modülü Yayında
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#0F172A] mb-6 max-w-4xl mx-auto leading-[1.1] animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
          Modern Üretim İçin <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">İşletim Sistemi</span>
        </h1>
        
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
          RenkFlow; siparişlerinizi, üretim hattınızı, personelinizi ve dokümanlarınızı tek bir akıllı platformda birleştirir. Operasyonlarınızı hızlandırın, hataları sıfıra indirin.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-300">
          <Link href="/login" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto bg-[#1E3A8A] text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-[#172554] transition-all shadow-xl shadow-blue-900/20 hover:shadow-blue-900/30 hover:-translate-y-1">
              Hemen Başlayın
            </button>
          </Link>
          <button className="w-full sm:w-auto bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl text-base font-semibold hover:bg-slate-50 transition-all hover:border-slate-300">
            Tanıtım Videosunu İzle
          </button>
        </div>

        {/* Dashboard Preview */}
        <div className="relative mx-auto max-w-6xl rounded-2xl bg-[#1E293B] p-2 shadow-2xl ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-1000 delay-500">
          <div className="rounded-xl bg-[#0F172A] overflow-hidden aspect-[16/9] relative group">
            {/* Mock UI Header */}
            <div className="absolute top-0 left-0 right-0 h-10 bg-[#1E293B] flex items-center px-4 gap-2 border-b border-slate-700 z-10">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
              </div>
              <div className="ml-4 h-5 w-64 bg-slate-700/50 rounded-md"></div>
            </div>
            
            {/* Dashboard Content Mock */}
            <div className="p-6 mt-10 grid grid-cols-12 gap-6 h-full opacity-90 group-hover:opacity-100 transition-opacity duration-500">
              {/* Sidebar Mock */}
              <div className="hidden md:block col-span-2 space-y-4 border-r border-slate-800 pr-4">
                <div className="h-8 w-full bg-blue-600/20 rounded-lg border border-blue-500/30"></div>
                <div className="h-4 w-3/4 bg-slate-800 rounded"></div>
                <div className="h-4 w-2/3 bg-slate-800 rounded"></div>
                <div className="h-4 w-4/5 bg-slate-800 rounded"></div>
              </div>
              
              {/* Main Content Mock */}
              <div className="col-span-12 md:col-span-10 space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 flex flex-col justify-between">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/20"></div>
                      <div className="h-4 w-16 bg-slate-700 rounded"></div>
                    </div>
                  ))}
                </div>
                
                {/* Chart Area */}
                <div className="grid grid-cols-3 gap-6 h-64">
                  <div className="col-span-2 bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 relative overflow-hidden">
                     <div className="absolute bottom-0 left-0 right-0 h-48 flex items-end justify-between px-6 gap-2">
                      {[40, 60, 45, 70, 50, 80, 65, 85, 75, 90, 60, 70, 55, 80, 95].map((h, i) => (
                        <div key={i} className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t opacity-80 hover:opacity-100 transition-opacity" style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-1 bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-700"></div>
                        <div className="h-3 w-full bg-slate-700/50 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-transparent to-transparent pointer-events-none"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 bg-slate-50 max-w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-base font-semibold text-blue-600 tracking-wide uppercase mb-2">Özellikler</h2>
            <h3 className="text-4xl font-bold text-[#0F172A] mb-4">İhtiyacınız olan her şey, tek bir yerde.</h3>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Siparişten teslimata kadar tüm süreci RenkFlow ile yönetin. Karmaşık Excel dosyalarından ve kağıt yığınlarından kurtulun.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "receipt_long",
                title: "Sipariş Yönetimi",
                desc: "Her siparişi teklif aşamasından teslimata kadar takip edin. Müşteri taleplerini asla gözden kaçırmayın.",
                color: "bg-blue-500"
              },
              {
                icon: "factory",
                title: "Üretim Planlama",
                desc: "Üretim hatlarınızı görselleştirin, takvimi yönetin ve darboğazları anlık olarak tespit edin.",
                color: "bg-cyan-500"
              },
              {
                icon: "groups",
                title: "Personel Takibi",
                desc: "Görev atamaları yapın, performansı ölçün ve ekibinizin iş yükünü dengeli bir şekilde yönetin.",
                color: "bg-indigo-500"
              },
              {
                icon: "folder_open",
                title: "Doküman Merkezi",
                desc: "Teknik çizimlerden sözleşmelere kadar tüm dosyaları güvenle saklayın ve her yerden erişin.",
                color: "bg-violet-500"
              },
              {
                icon: "analytics",
                title: "Gelişmiş Raporlama",
                desc: "İşletmenizin verimliliğini ölçen detaylı raporlar alın. Veriye dayalı kararlar verin.",
                color: "bg-rose-500"
              },
              {
                icon: "integration_instructions",
                title: "Kolay Entegrasyon",
                desc: "Muhasebe ve lojistik yazılımlarınızla sorunsuz entegrasyon sağlayın.",
                color: "bg-emerald-500"
              }
            ].map((feature, i) => (
              <div key={i} className="group bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className={`w-12 h-12 ${feature.color} bg-opacity-10 rounded-xl flex items-center justify-center text-${feature.color.replace('bg-', '')} mb-6 group-hover:scale-110 transition-transform`}>
                  <span className="material-symbols-outlined text-2xl" style={{ color: 'inherit' }}>{feature.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-[#0F172A] mb-3">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 bg-white max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-base font-semibold text-blue-600 tracking-wide uppercase mb-2">Nasıl Çalışır?</h2>
            <h3 className="text-4xl font-bold text-[#0F172A] mb-6">Karmaşık süreçleri basitleştirin.</h3>
            <div className="space-y-8">
              {[
                { step: "01", title: "Sipariş Oluşturun", desc: "Müşteri taleplerini sisteme girin, dosyaları yükleyin ve termin tarihi belirleyin." },
                { step: "02", title: "Üretime Atayın", desc: "İşi uygun personele veya hatta atayın. Öncelik sırasını belirleyin." },
                { step: "03", title: "Canlı Takip Edin", desc: "Üretim aşamalarını anlık olarak izleyin. Gecikmelerden haberdar olun." },
                { step: "04", title: "Teslim Edin", desc: "Tamamlanan ürünleri kalite kontrolden geçirin ve müşteriye sevk edin." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[#0F172A]">{item.title}</h4>
                    <p className="text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-3xl transform rotate-3"></div>
            <div className="relative bg-slate-900 rounded-3xl p-8 shadow-2xl transform -rotate-2 hover:rotate-0 transition-transform duration-500">
              {/* Abstract UI Representation */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                  <div className="h-4 w-32 bg-slate-700 rounded"></div>
                  <div className="h-8 w-24 bg-blue-600 rounded-lg"></div>
                </div>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-700"></div>
                      <div className="space-y-2">
                        <div className="h-3 w-24 bg-slate-600 rounded"></div>
                        <div className="h-2 w-16 bg-slate-700 rounded"></div>
                      </div>
                    </div>
                    <div className="h-6 w-20 bg-green-500/20 rounded-full"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-[#0F172A] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-cyan-500 rounded-full blur-3xl opacity-20"></div>
        
        <div className="max-w-4xl mx-auto text-center px-4 relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            İşletmenizi Dönüştürmeye Hazır mısınız?
          </h2>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
            Yüzlerce modern fabrika, büyüme ve verimlilik için RenkFlow&apos;a güveniyor. Bugün ücretsiz demoyu deneyin.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/login">
              <button className="bg-white text-[#0F172A] px-8 py-4 rounded-xl text-base font-bold hover:bg-blue-50 transition-colors shadow-lg shadow-white/10">
                Ücretsiz Demo Talep Et
              </button>
            </Link>
            <button className="bg-transparent border border-slate-600 text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-slate-800 transition-colors">
              Bize Ulaşın
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="size-6 rounded-full bg-[#0F172A] flex items-center justify-center">
                 <span className="material-symbols-outlined text-white text-xs">factory</span>
              </div>
              <span className="text-lg font-bold text-[#0F172A]">RenkFlow</span>
            </div>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
              Modern üretim tesisleri için geliştirilmiş, uçtan uca yönetim ve takip sistemi.
            </p>
            <div className="flex gap-4 mt-6">
              {['twitter', 'linkedin', 'instagram'].map((social) => (
                <a key={social} href="#" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#0F172A] hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-sm">share</span>
                </a>
              ))}
            </div>
          </div>
          
          {[
            { title: "Ürün", links: ["Özellikler", "Fiyatlandırma", "Entegrasyonlar", "Yol Haritası"] },
            { title: "Şirket", links: ["Hakkımızda", "Kariyer", "Blog", "İletişim"] },
            { title: "Kaynaklar", links: ["Yardım Merkezi", "API Dokümantasyonu", "Sistem Durumu"] }
          ].map((col, i) => (
            <div key={i}>
              <h4 className="font-bold text-[#0F172A] mb-4">{col.title}</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                {col.links.map((link, j) => (
                  <li key={j}><a href="#" className="hover:text-blue-600 transition-colors">{link}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} RenkFlow A.Ş. Tüm hakları saklıdır.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#0F172A]">Gizlilik Politikası</a>
            <a href="#" className="hover:text-[#0F172A]">Kullanım Koşulları</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
