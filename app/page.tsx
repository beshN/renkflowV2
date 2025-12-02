import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-24 z-50 transition-all duration-300 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative h-14 w-48 transition-transform hover:scale-105 duration-300">
              <Image 
                src="/logo.png" 
                alt="RenkFlow" 
                fill 
                className="object-contain object-left"
                priority
              />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-10 text-sm font-medium text-slate-600">
            {['Özellikler', 'Nasıl Çalışır?', 'SSS', 'İletişim'].map((item) => (
              <Link key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-').replace('?', '')}`} className="hover:text-indigo-600 transition-colors relative group py-2">
                {item}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-600 transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors hidden sm:block">
              Giriş Yap
            </Link>
            <Link href="/login">
              <button className="bg-[#0F172A] text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-indigo-600 transition-all hover:shadow-xl hover:shadow-indigo-500/20 active:scale-95 transform duration-200">
                Demo Talep Et
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6 lg:px-8 text-center max-w-[1400px] mx-auto relative">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-indigo-50/80 via-white to-transparent rounded-[100%] blur-3xl -z-10 pointer-events-none"></div>
        <div className="absolute top-20 right-0 w-96 h-96 bg-cyan-100/40 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>
        <div className="absolute top-40 left-0 w-72 h-72 bg-purple-100/40 rounded-full blur-3xl -z-10 animate-pulse"></div>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-600 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 hover:border-indigo-200 hover:text-indigo-600 transition-colors cursor-default group">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="group-hover:underline decoration-indigo-300 underline-offset-2">Yeni: Gelişmiş Raporlama Modülü Yayında</span>
          <span className="material-symbols-outlined text-sm ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </div>
        
        <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-[#0F172A] mb-8 max-w-5xl mx-auto leading-[1.05] animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
          Modern Üretim İçin <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 animate-gradient-x pb-2">İşletim Sistemi</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-500 max-w-3xl mx-auto mb-14 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 font-light tracking-wide">
          RenkFlow; siparişlerinizi, üretim hattınızı, personelinizi ve dokümanlarınızı tek bir akıllı platformda birleştirir. <strong className="text-slate-800 font-medium">Operasyonlarınızı hızlandırın, hataları sıfıra indirin.</strong>
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-28 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-300">
          <Link href="/login" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto bg-indigo-600 text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-1 ring-4 ring-indigo-50">
              Hemen Başlayın
            </button>
          </Link>
          <button className="w-full sm:w-auto bg-white text-slate-700 border border-slate-200 px-10 py-5 rounded-2xl text-lg font-bold hover:bg-slate-50 transition-all hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/40 flex items-center justify-center gap-2 group">
            <span className="material-symbols-outlined group-hover:scale-110 transition-transform">play_circle</span>
            Tanıtım Videosunu İzle
          </button>
        </div>

        {/* Dashboard Preview - Premium 3D Effect */}
        <div className="relative mx-auto max-w-7xl perspective-1000 group perspective-container">
          <div className="relative rounded-2xl bg-slate-900 p-3 shadow-2xl shadow-indigo-900/20 ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-1000 delay-500 transform transition-all duration-700 hover:rotate-x-2 hover:scale-[1.02]">
            <div className="rounded-xl bg-[#0F172A] overflow-hidden aspect-[16/9] relative">
              {/* Mock UI Header */}
              <div className="absolute top-0 left-0 right-0 h-12 bg-[#1E293B]/80 backdrop-blur-md flex items-center px-6 gap-3 border-b border-slate-700/50 z-10">
                <div className="flex gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] shadow-inner"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] shadow-inner"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-[#27C93F] shadow-inner"></div>
                </div>
                <div className="ml-6 h-6 w-80 bg-slate-700/30 rounded-lg border border-slate-600/20"></div>
              </div>
              
              {/* Dashboard Content Mock */}
              <div className="p-8 mt-12 grid grid-cols-12 gap-8 h-full opacity-90 group-hover:opacity-100 transition-opacity duration-500">
                {/* Sidebar Mock */}
                <div className="hidden md:block col-span-2 space-y-6 border-r border-slate-800/50 pr-6">
                  <div className="h-10 w-full bg-indigo-500/20 rounded-xl border border-indigo-500/30 relative overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent"></div>
                  </div>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-5 w-3/4 bg-slate-800/50 rounded-lg"></div>
                  ))}
                </div>
                
                {/* Main Content Mock */}
                <div className="col-span-12 md:col-span-10 space-y-8">
                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-32 bg-slate-800/30 rounded-2xl border border-slate-700/30 p-5 flex flex-col justify-between hover:bg-slate-800/50 transition-colors backdrop-blur-sm">
                        <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/20"></div>
                        <div className="space-y-2">
                           <div className="h-6 w-12 bg-slate-700/50 rounded-lg"></div>
                           <div className="h-4 w-24 bg-slate-700/30 rounded-lg"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Chart Area */}
                  <div className="grid grid-cols-3 gap-8 h-80">
                    <div className="col-span-2 bg-slate-800/20 rounded-2xl border border-slate-700/30 p-8 relative overflow-hidden group/chart backdrop-blur-sm">
                       <div className="absolute bottom-0 left-0 right-0 h-64 flex items-end justify-between px-8 gap-3">
                        {[40, 60, 45, 70, 50, 80, 65, 85, 75, 90, 60, 70, 55, 80, 95].map((h, i) => (
                          <div key={i} className="w-full bg-gradient-to-t from-indigo-600 to-cyan-400 rounded-t-md opacity-70 group-hover/chart:opacity-100 transition-all duration-500 ease-out" style={{ height: `${h}%`, transitionDelay: `${i * 30}ms` }}></div>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-1 bg-slate-800/20 rounded-2xl border border-slate-700/30 p-6 space-y-4 backdrop-blur-sm">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-2 rounded-xl hover:bg-slate-700/20 transition-colors">
                          <div className="h-10 w-10 rounded-full bg-slate-700/50"></div>
                          <div className="h-4 w-full bg-slate-700/30 rounded-lg"></div>
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
        </div>
      </section>

      {/* Social Proof / Trusted By */}
      <section className="py-16 border-y border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-8">Sektör Liderleri Tarafından Tercih Ediliyor</p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-20 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
             {/* Mock Logos - Using text for now but styled like logos */}
             {['TechManufacturing', 'FutureWorks', 'GlobalInd', 'SmartFactory', 'EcoProd'].map((logo) => (
               <span key={logo} className="text-2xl font-bold text-slate-800 font-display">{logo}</span>
             ))}
          </div>
        </div>
      </section>

      {/* Features Section - Asymmetric Layout */}
      <section id="features" className="py-32 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="mb-24 md:text-center max-w-3xl mx-auto">
            <h2 className="text-indigo-600 font-bold tracking-wide uppercase mb-4 text-sm">Özellikler</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-[#0F172A] mb-6 leading-tight">İhtiyacınız olan her şey, <br/>tek bir güçlü platformda.</h3>
            <p className="text-xl text-slate-500 font-light leading-relaxed">
              Siparişten teslimata kadar tüm süreci RenkFlow ile yönetin. Karmaşık Excel dosyalarından ve kağıt yığınlarından kurtulun.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "receipt_long",
                title: "Sipariş Yönetimi",
                desc: "Her siparişi teklif aşamasından teslimata kadar takip edin. Müşteri taleplerini asla gözden kaçırmayın.",
                color: "bg-blue-500",
                gradient: "from-blue-500 to-blue-600"
              },
              {
                icon: "factory",
                title: "Üretim Planlama",
                desc: "Üretim hatlarınızı görselleştirin, takvimi yönetin ve darboğazları anlık olarak tespit edin.",
                color: "bg-cyan-500",
                gradient: "from-cyan-500 to-cyan-600"
              },
              {
                icon: "groups",
                title: "Personel Takibi",
                desc: "Görev atamaları yapın, performansı ölçün ve ekibinizin iş yükünü dengeli bir şekilde yönetin.",
                color: "bg-indigo-500",
                gradient: "from-indigo-500 to-indigo-600"
              },
              {
                icon: "folder_open",
                title: "Doküman Merkezi",
                desc: "Teknik çizimlerden sözleşmelere kadar tüm dosyaları güvenle saklayın ve her yerden erişin.",
                color: "bg-violet-500",
                gradient: "from-violet-500 to-violet-600"
              },
              {
                icon: "analytics",
                title: "Gelişmiş Raporlama",
                desc: "İşletmenizin verimliliğini ölçen detaylı raporlar alın. Veriye dayalı kararlar verin.",
                color: "bg-rose-500",
                gradient: "from-rose-500 to-rose-600"
              },
              {
                icon: "integration_instructions",
                title: "Kolay Entegrasyon",
                desc: "Muhasebe ve lojistik yazılımlarınızla sorunsuz entegrasyon sağlayın.",
                color: "bg-emerald-500",
                gradient: "from-emerald-500 to-emerald-600"
              }
            ].map((feature, i) => (
              <div key={i} className="group bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-900/5 hover:-translate-y-2 transition-all duration-500 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-5 rounded-bl-[100%] transition-opacity group-hover:opacity-10`}></div>
                
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-8 shadow-lg shadow-${feature.color}/20 group-hover:scale-110 transition-transform duration-300`}>
                  <span className="material-symbols-outlined text-3xl">{feature.icon}</span>
                </div>
                <h3 className="text-2xl font-bold text-[#0F172A] mb-4">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed font-light text-lg">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section - Dark Mode Contrast */}
      <section id="how-it-works" className="py-32 bg-[#0F172A] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-soft-light"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-indigo-400 font-bold tracking-wide uppercase mb-4 text-sm">Nasıl Çalışır?</h2>
              <h3 className="text-4xl md:text-5xl font-bold mb-10 leading-tight">Karmaşık süreçleri <br/>basitleştirin.</h3>
              <div className="space-y-12">
                {[
                  { step: "01", title: "Sipariş Oluşturun", desc: "Müşteri taleplerini sisteme girin, dosyaları yükleyin ve termin tarihi belirleyin." },
                  { step: "02", title: "Üretime Atayın", desc: "İşi uygun personele veya hatta atayın. Öncelik sırasını belirleyin." },
                  { step: "03", title: "Canlı Takip Edin", desc: "Üretim aşamalarını anlık olarak izleyin. Gecikmelerden haberdar olun." },
                  { step: "04", title: "Teslim Edin", desc: "Tamamlanan ürünleri kalite kontrolden geçirin ve müşteriye sevk edin." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-8 group">
                    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-slate-400 border border-slate-700 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all duration-300 shadow-lg">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold mb-3 group-hover:text-indigo-400 transition-colors">{item.title}</h4>
                      <p className="text-slate-400 leading-relaxed font-light text-lg">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 to-cyan-500/30 rounded-[3rem] transform rotate-6 blur-3xl"></div>
              <div className="relative bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl transform -rotate-3 hover:rotate-0 transition-transform duration-700 border border-slate-700/50">
                {/* Abstract UI Representation */}
                <div className="space-y-8">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-8">
                    <div className="h-6 w-40 bg-slate-800 rounded-full"></div>
                    <div className="h-12 w-32 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20"></div>
                  </div>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-slate-800/50 p-6 rounded-3xl flex items-center justify-between hover:bg-slate-800 transition-colors cursor-default border border-slate-700/30">
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 rounded-2xl bg-slate-700 flex items-center justify-center">
                           <div className="h-6 w-6 rounded-full bg-slate-600"></div>
                        </div>
                        <div className="space-y-3">
                          <div className="h-4 w-40 bg-slate-600 rounded-full"></div>
                          <div className="h-3 w-24 bg-slate-700 rounded-full"></div>
                        </div>
                      </div>
                      <div className="h-10 w-28 bg-emerald-500/10 rounded-full border border-emerald-500/20 flex items-center justify-center">
                         <div className="h-2 w-16 bg-emerald-500/40 rounded-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center px-6 relative z-10">
          <h2 className="text-5xl md:text-7xl font-bold text-[#0F172A] mb-10 tracking-tight">
            İşletmenizi Dönüştürmeye <br/>Hazır mısınız?
          </h2>
          <p className="text-2xl text-slate-500 mb-14 max-w-3xl mx-auto font-light leading-relaxed">
            Yüzlerce modern fabrika, büyüme ve verimlilik için RenkFlow&apos;a güveniyor. Bugün ücretsiz demoyu deneyin.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/login">
              <button className="bg-[#0F172A] text-white px-12 py-6 rounded-2xl text-xl font-bold hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-900/20 hover:shadow-indigo-600/30 hover:-translate-y-1">
                Ücretsiz Demo Talep Et
              </button>
            </Link>
            <button className="bg-white border-2 border-slate-200 text-slate-700 px-12 py-6 rounded-2xl text-xl font-bold hover:bg-slate-50 transition-all hover:border-slate-300">
              Bize Ulaşın
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 py-24 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-16 mb-24">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-10">
                <div className="relative h-12 w-40">
                  <Image 
                    src="/logo.png" 
                    alt="RenkFlow" 
                    fill 
                    className="object-contain object-left"
                  />
                </div>
              </div>
              <p className="text-lg text-slate-500 max-w-sm leading-relaxed font-light mb-10">
                Modern üretim tesisleri için geliştirilmiş, uçtan uca yönetim ve takip sistemi.
              </p>
              <div className="flex gap-5">
                {['twitter', 'linkedin', 'instagram'].map((social) => (
                  <a key={social} href="#" className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-[#0F172A] hover:text-white hover:border-[#0F172A] transition-all duration-300 shadow-sm">
                    <span className="material-symbols-outlined text-xl">share</span>
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
                <h4 className="font-bold text-[#0F172A] mb-8 text-lg">{col.title}</h4>
                <ul className="space-y-5 text-slate-500">
                  {col.links.map((link, j) => (
                    <li key={j}><a href="#" className="hover:text-indigo-600 transition-colors block hover:translate-x-1 duration-200 text-lg font-light">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="pt-10 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-400 font-light">
            <p>© {new Date().getFullYear()} RenkFlow A.Ş. Tüm hakları saklıdır.</p>
            <div className="flex gap-10">
              <a href="#" className="hover:text-[#0F172A] transition-colors">Gizlilik Politikası</a>
              <a href="#" className="hover:text-[#0F172A] transition-colors">Kullanım Koşulları</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
