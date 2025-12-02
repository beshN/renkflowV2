import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 z-50 transition-all duration-300 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-32">
              <Image 
                src="/logo.png" 
                alt="RenkFlow" 
                fill 
                className="object-contain object-left"
                priority
              />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link href="#features" className="hover:text-blue-600 transition-colors relative group">
              Özellikler
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
            </Link>
            <Link href="#how-it-works" className="hover:text-blue-600 transition-colors relative group">
              Nasıl Çalışır?
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
            </Link>
            <Link href="#faq" className="hover:text-blue-600 transition-colors relative group">
              SSS
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
            </Link>
            <Link href="#contact" className="hover:text-blue-600 transition-colors relative group">
              İletişim
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full"></span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors hidden sm:block">
              Giriş Yap
            </Link>
            <Link href="/login">
              <button className="bg-[#0F172A] text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-blue-600 transition-all hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 transform duration-200">
                Demo Talep Et
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 text-center max-w-7xl mx-auto relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-blue-50/50 to-transparent rounded-[100%] blur-3xl -z-10 pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-xs font-semibold text-blue-700 mb-8 border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-700 hover:bg-blue-100 transition-colors cursor-default">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Yeni: Gelişmiş Raporlama Modülü Yayında
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-[#0F172A] mb-8 max-w-5xl mx-auto leading-[1.1] animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
          Modern Üretim İçin <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 animate-gradient-x">İşletim Sistemi</span>
        </h1>
        
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 font-light">
          RenkFlow; siparişlerinizi, üretim hattınızı, personelinizi ve dokümanlarınızı tek bir akıllı platformda birleştirir. <strong className="text-slate-700 font-medium">Operasyonlarınızı hızlandırın, hataları sıfıra indirin.</strong>
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-300">
          <Link href="/login" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30 hover:-translate-y-1">
              Hemen Başlayın
            </button>
          </Link>
          <button className="w-full sm:w-auto bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-slate-50 transition-all hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50">
            Tanıtım Videosunu İzle
          </button>
        </div>

        {/* Dashboard Preview */}
        <div className="relative mx-auto max-w-6xl rounded-2xl bg-[#1E293B] p-2 shadow-2xl shadow-blue-900/20 ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-1000 delay-500 transform hover:scale-[1.01] transition-transform duration-700">
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
                    <div key={i} className="h-24 bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 flex flex-col justify-between hover:bg-slate-800/80 transition-colors">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/20"></div>
                      <div className="h-4 w-16 bg-slate-700 rounded"></div>
                    </div>
                  ))}
                </div>
                
                {/* Chart Area */}
                <div className="grid grid-cols-3 gap-6 h-64">
                  <div className="col-span-2 bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 relative overflow-hidden group/chart">
                     <div className="absolute bottom-0 left-0 right-0 h-48 flex items-end justify-between px-6 gap-2">
                      {[40, 60, 45, 70, 50, 80, 65, 85, 75, 90, 60, 70, 55, 80, 95].map((h, i) => (
                        <div key={i} className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t opacity-80 group-hover/chart:opacity-100 transition-all duration-300" style={{ height: `${h}%` }}></div>
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
            <h2 className="text-sm font-bold text-blue-600 tracking-widest uppercase mb-3">Özellikler</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-[#0F172A] mb-6">İhtiyacınız olan her şey, <br/>tek bir yerde.</h3>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto font-light">
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
              <div key={i} className="group bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-900/5 hover:-translate-y-2 transition-all duration-500">
                <div className={`w-14 h-14 ${feature.color} bg-opacity-10 rounded-2xl flex items-center justify-center text-${feature.color.replace('bg-', '')} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <span className="material-symbols-outlined text-3xl" style={{ color: 'inherit' }}>{feature.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-[#0F172A] mb-3">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed font-light">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 bg-white max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-sm font-bold text-blue-600 tracking-widest uppercase mb-3">Nasıl Çalışır?</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-[#0F172A] mb-8">Karmaşık süreçleri <br/>basitleştirin.</h3>
            <div className="space-y-10">
              {[
                { step: "01", title: "Sipariş Oluşturun", desc: "Müşteri taleplerini sisteme girin, dosyaları yükleyin ve termin tarihi belirleyin." },
                { step: "02", title: "Üretime Atayın", desc: "İşi uygun personele veya hatta atayın. Öncelik sırasını belirleyin." },
                { step: "03", title: "Canlı Takip Edin", desc: "Üretim aşamalarını anlık olarak izleyin. Gecikmelerden haberdar olun." },
                { step: "04", title: "Teslim Edin", desc: "Tamamlanan ürünleri kalite kontrolden geçirin ve müşteriye sevk edin." }
              ].map((item, i) => (
                <div key={i} className="flex gap-6 group">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-bold text-slate-400 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-[#0F172A] mb-2 group-hover:text-blue-600 transition-colors">{item.title}</h4>
                    <p className="text-slate-500 leading-relaxed font-light">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-[3rem] transform rotate-3 blur-2xl"></div>
            <div className="relative bg-[#0F172A] rounded-[2.5rem] p-8 shadow-2xl transform -rotate-2 hover:rotate-0 transition-transform duration-700 border border-slate-800">
              {/* Abstract UI Representation */}
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-6">
                  <div className="h-5 w-32 bg-slate-800 rounded-full"></div>
                  <div className="h-10 w-28 bg-blue-600 rounded-xl"></div>
                </div>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-slate-800/50 p-5 rounded-2xl flex items-center justify-between hover:bg-slate-800 transition-colors cursor-default">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-slate-700"></div>
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-slate-600 rounded-full"></div>
                        <div className="h-3 w-20 bg-slate-700 rounded-full"></div>
                      </div>
                    </div>
                    <div className="h-8 w-24 bg-green-500/20 rounded-full border border-green-500/30"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-[#0F172A] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
        <div className="absolute top-0 right-0 -mt-40 -mr-40 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[120px] opacity-30 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 -mb-40 -ml-40 w-[600px] h-[600px] bg-cyan-600 rounded-full blur-[120px] opacity-30 animate-pulse delay-700"></div>
        
        <div className="max-w-4xl mx-auto text-center px-4 relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 tracking-tight">
            İşletmenizi Dönüştürmeye <br/>Hazır mısınız?
          </h2>
          <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Yüzlerce modern fabrika, büyüme ve verimlilik için RenkFlow&apos;a güveniyor. Bugün ücretsiz demoyu deneyin.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/login">
              <button className="bg-white text-[#0F172A] px-10 py-5 rounded-2xl text-lg font-bold hover:bg-blue-50 transition-all shadow-xl shadow-white/10 hover:shadow-white/20 hover:-translate-y-1">
                Ücretsiz Demo Talep Et
              </button>
            </Link>
            <button className="bg-transparent border border-slate-700 text-white px-10 py-5 rounded-2xl text-lg font-semibold hover:bg-slate-800 transition-all hover:border-slate-600">
              Bize Ulaşın
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-20">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-8">
              <div className="relative h-8 w-24">
                <Image 
                  src="/logo.png" 
                  alt="RenkFlow" 
                  fill 
                  className="object-contain object-left"
                />
              </div>
            </div>
            <p className="text-base text-slate-500 max-w-xs leading-relaxed font-light mb-8">
              Modern üretim tesisleri için geliştirilmiş, uçtan uca yönetim ve takip sistemi.
            </p>
            <div className="flex gap-4">
              {['twitter', 'linkedin', 'instagram'].map((social) => (
                <a key={social} href="#" className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-[#0F172A] hover:text-white transition-all duration-300">
                  <span className="material-symbols-outlined text-lg">share</span>
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
              <h4 className="font-bold text-[#0F172A] mb-6 text-lg">{col.title}</h4>
              <ul className="space-y-4 text-slate-500">
                {col.links.map((link, j) => (
                  <li key={j}><a href="#" className="hover:text-blue-600 transition-colors block hover:translate-x-1 duration-200">{link}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400 font-light">
          <p>© {new Date().getFullYear()} RenkFlow A.Ş. Tüm hakları saklıdır.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-[#0F172A] transition-colors">Gizlilik Politikası</a>
            <a href="#" className="hover:text-[#0F172A] transition-colors">Kullanım Koşulları</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
