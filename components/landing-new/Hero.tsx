'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Mail, ShieldCheck, CheckCircle2, Factory, Wrench, Package, BarChart3, ChevronRight } from 'lucide-react';

import { toast } from 'sonner';

export const Hero: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
        toast.error('Lütfen e-posta adresinizi girin.');
        return;
    }
    
    setStatus('loading');

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        toast.success(data.message);
        setEmail('');
      } else {
        setStatus('idle');
        toast.error(data.error || 'Bir hata oluştu.');
      }
    } catch (error) {
      setStatus('idle');
      toast.error('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  };

  const features = [
    { icon: Factory, label: 'Üretim Yönetimi', desc: 'Planlama & takip' },
    { icon: Wrench, label: 'Bakım Yönetimi', desc: 'Önleyici bakım' },
    { icon: Package, label: 'Stok & Tedarik', desc: 'Envanter kontrolü' },
    { icon: BarChart3, label: 'Raporlama', desc: 'Analitik & KPI' },
  ];

  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/10">
      
      {/* Background - Softened Grid */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/8 blur-[100px]" />
        <div className="absolute top-20 -right-40 h-[450px] w-[450px] rounded-full bg-indigo-500/6 blur-[100px]" />
        
        {/* Softer, masked grid - MORE VISIBLE */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(circle at center, transparent 5%, black 60%)'
          }}
        />
      </div>

      {/* Page wrapper */}
      <div className="relative z-10 flex h-full flex-col">
        
        {/* Header with logo - perfectly aligned, 1.1x larger */}
        <header className="w-full pl-6 lg:pl-8">
          <Image
            src="/renkflow-logo-new.png"
            alt="RenkFlow"
            width={1000}
            height={250}
            priority
            className="h-48 sm:h-60 md:h-64 lg:h-[17rem] w-auto -ml-6 -mt-14 lg:-mt-16"
          />
        </header>

        {/* Main content - Moved up slightly with justify-start + pt */}
        <main className="flex flex-1 flex-col items-center justify-center -mt-10 px-6 sm:-mt-16">
          
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-blue-100 bg-white/80 px-4 py-1.5 shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-600 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
            </span>
            <span className="text-sm font-semibold text-slate-700">Çok Yakında...</span>
          </div>

          {/* Headline - Fixed Flow */}
          <h1 className="mb-4 max-w-4xl text-center text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl md:text-5xl lg:text-6xl">
            Şirketinizin ihtiyacı olan tek yazılım:{' '}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              RenkFlow.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mb-3 text-lg font-medium text-slate-600 sm:text-xl md:text-2xl lg:text-3xl">
            Planla. Takip et. Optimize et.
          </p>

          <p className="mb-8 max-w-xl text-center text-sm leading-relaxed text-slate-500 sm:text-base md:text-lg">
            <span className="block">
              RenkFlow ile üretim süreçlerinizi modernize edin, verimliliği artırın.
            </span>
            <span className="block mt-1">
              Erken erişim listesine katılın, ilk siz haberdar olun.
            </span>
          </p>

          {/* Email form - Updated CTA */}
          <div className="w-full max-w-md">
            {status === 'success' ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <div className="rounded-full bg-green-100 p-2.5 text-green-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <h4 className="text-base font-semibold text-slate-900">Teşekkürler!</h4>
                  <p className="text-sm text-slate-600">Sizi bekleme listesine ekledik.</p>
                </div>
                <button
                  onClick={() => setStatus('idle')}
                  className="text-sm text-slate-500 underline hover:text-slate-900"
                >
                  Başka e-posta ekle
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <div className="relative flex-grow">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      
                      disabled={status === 'loading'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-base text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="E-posta adresiniz"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 sm:text-base"
                  >
                    {status === 'loading' ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <>
                        Haber Ver <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
                <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-500 sm:text-sm">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <span>Spam yok, sadece önemli güncellemeler.</span>
                </div>
              </div>
            )}
          </div>

          {/* Feature cards - Updated icons/labels */}
          <div className="mt-12 w-full max-w-2xl">
            <div className="grid grid-cols-4 gap-3">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group rounded-xl border border-slate-200 bg-white/60 p-3.5 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md"
                >
                  <feature.icon className="mb-1.5 h-5 w-5 text-blue-600 sm:h-6 sm:w-6" />
                  <h3 className="text-xs font-semibold text-slate-800 sm:text-sm">{feature.label}</h3>
                  <p className="text-[10px] text-slate-500 sm:text-xs">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-slate-100 bg-white/40 py-3 text-center backdrop-blur-sm">
          <p className="text-xs text-slate-400 sm:text-sm">
            © {new Date().getFullYear()} RenkFlow. Tüm hakları saklıdır.
          </p>
        </footer>
      </div>
    </div>
  );
};
