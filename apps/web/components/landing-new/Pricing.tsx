'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export const Pricing: React.FC = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <section className="relative overflow-hidden bg-white py-24 dark:bg-slate-950" id="pricing">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                Her ölçekteki işletme için <br/>
                <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 bg-clip-text text-transparent">şeffaf fiyatlandırma.</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                Gizli ücret yok. Taahhüt yok. İstediğiniz zaman iptal edin.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-medium ${!annual ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Aylık</span>
                <button 
                    onClick={() => setAnnual(!annual)}
                    className="relative w-14 h-7 rounded-full bg-slate-200 dark:bg-slate-800 transition-colors p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
                >
                    <div 
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${annual ? 'translate-x-7' : 'translate-x-0'}`} 
                    />
                </button>
                <span className={`text-sm font-medium ${annual ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                    Yıllık <span className="text-emerald-600 text-xs font-bold bg-emerald-100 px-2 py-0.5 rounded-full ml-1">%20 İndirim</span>
                </span>
            </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Starter */}
            <div className="p-8 rounded-3xl bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)]">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Başlangıç</h3>
                <p className="text-sm text-slate-500 mb-6">Küçük ekipler ve startup&apos;lar için.</p>
                <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">₺{annual ? '490' : '590'}</span>
                    <span className="text-slate-500">/ay</span>
                </div>
                <Link href="/auth/login" className="block rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">
                  Giris Yap
                </Link>
                <ul className="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex gap-3"><Check size={18} className="text-sky-600" /> 5 Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-sky-600" /> Temel Otomasyon</li>
                    <li className="flex gap-3"><Check size={18} className="text-sky-600" /> 1GB Depolama</li>
                    <li className="flex gap-3"><Check size={18} className="text-slate-300" /> Gelişmiş Raporlar</li>
                </ul>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-sky-600 via-blue-600 to-emerald-600 text-white relative transform md:-translate-y-4 shadow-2xl shadow-sky-500/20">
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
                    EN POPÜLER
                </div>
                <h3 className="font-semibold mb-2">Profesyonel</h3>
                <p className="text-sm text-slate-300 mb-6">Büyüyen işletmeler için ideal.</p>
                <div className="mb-6">
                    <span className="text-4xl font-bold">₺{annual ? '990' : '1190'}</span>
                    <span className="text-slate-300">/ay</span>
                </div>
                <Link href="/contact" className="block rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100">
                  Demo Talep Et
                </Link>
                <ul className="mt-8 space-y-4 text-sm text-slate-100">
                    <li className="flex gap-3"><Check size={18} className="text-white/80" /> 20 Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-white/80" /> Sınırsız Otomasyon</li>
                    <li className="flex gap-3"><Check size={18} className="text-white/80" /> 50GB Depolama</li>
                    <li className="flex gap-3"><Check size={18} className="text-white/80" /> Gelişmiş Raporlar</li>
                    <li className="flex gap-3"><Check size={18} className="text-white/80" /> Öncelikli Destek</li>
                </ul>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-3xl bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)]">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Kurumsal</h3>
                <p className="text-sm text-slate-500 mb-6">Büyük organizasyonlar için.</p>
                <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">İletişim</span>
                </div>
                <Link href="/contact" className="block rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">
                  Satışla Görüş
                </Link>
                <ul className="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600" /> Sınırsız Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600" /> Özel Entegrasyonlar</li>
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600" /> SLA & 7/24 Destek</li>
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600" /> Kendi Sunucunuzda (On-Prem)</li>
                </ul>
            </div>

        </div>

      </div>
    </section>
  );
};
