'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export const PricingSection: React.FC = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="py-24 bg-white/90 dark:bg-slate-950 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(14,165,233,0.12),transparent_45%),radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.1),transparent_45%)]"
      />
      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
            <motion.p 
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"
            >
                Planlar
            </motion.p>
            <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-6 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4"
            >
                Her ölçekteki işletme için <br/>
                <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 bg-clip-text text-transparent">şeffaf fiyatlandırma.</span>
            </motion.h2>
            <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-lg text-slate-600 dark:text-slate-400 mb-8"
            >
                Gizli ücret yok. Taahhüt yok. İstediğiniz zaman iptal edin.
            </motion.p>

            {/* Toggle */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-center gap-4"
            >
                <span className={`text-sm font-medium ${!annual ? 'text-slate-900 dark:text-white' : 'text-slate-500'} cursor-pointer`} onClick={() => setAnnual(false)}>Aylık</span>
                <button 
                    onClick={() => setAnnual(!annual)}
                    className="relative w-14 h-7 rounded-full bg-slate-200 dark:bg-slate-800 transition-colors p-1 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                >
                    <div 
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-spring ${annual ? 'translate-x-7' : 'translate-x-0'}`} 
                    />
                </button>
                <span className={`text-sm font-medium ${annual ? 'text-slate-900 dark:text-white' : 'text-slate-500'} cursor-pointer`} onClick={() => setAnnual(true)}>
                    Yıllık <span className="text-emerald-600 text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full ml-1">%20 İndirim</span>
                </span>
            </motion.div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Starter */}
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="p-8 rounded-3xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-300 shadow-[0_20px_40px_-35px_rgba(15,23,42,0.35)]"
            >
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-xl">Başlangıç</h3>
                <p className="text-sm text-slate-500 mb-6">Küçük ekipler ve startup&apos;lar için.</p>
                <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">₺{annual ? '490' : '590'}</span>
                    <span className="text-slate-500">/ay</span>
                </div>
                <Link href="/signup" className="block w-full text-center py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    Ücretsiz Dene
                </Link>
                <ul className="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex gap-3"><Check size={18} className="text-sky-600 flex-shrink-0" /> 5 Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-sky-600 flex-shrink-0" /> Temel Otomasyon</li>
                    <li className="flex gap-3"><Check size={18} className="text-sky-600 flex-shrink-0" /> 1GB Depolama</li>
                    <li className="flex gap-3"><Check size={18} className="text-slate-300 dark:text-slate-600 flex-shrink-0" /> Gelişmiş Raporlar</li>
                </ul>
            </motion.div>

            {/* Pro */}
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="p-8 rounded-3xl bg-gradient-to-br from-sky-600 via-blue-600 to-emerald-600 text-white dark:bg-slate-900 relative transform md:-translate-y-4 shadow-2xl shadow-sky-500/20 ring-1 ring-white/10"
            >
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl shadow-sm">
                    EN POPÜLER
                </div>
                <h3 className="font-semibold mb-2 text-xl">Profesyonel</h3>
                <p className="text-sm text-slate-300 mb-6">Büyüyen işletmeler için ideal.</p>
                <div className="mb-6">
                    <span className="text-4xl font-bold">₺{annual ? '990' : '1190'}</span>
                    <span className="text-slate-300">/ay</span>
                </div>
                <Link href="/signup" className="block w-full text-center py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors shadow-lg shadow-blue-900/20">
                    Hemen Başla
                </Link>
                <ul className="mt-8 space-y-4 text-sm text-slate-100">
                    <li className="flex gap-3"><Check size={18} className="text-white/80 flex-shrink-0" /> 20 Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-white/80 flex-shrink-0" /> Sınırsız Otomasyon</li>
                    <li className="flex gap-3"><Check size={18} className="text-white/80 flex-shrink-0" /> 50GB Depolama</li>
                    <li className="flex gap-3"><Check size={18} className="text-white/80 flex-shrink-0" /> Gelişmiş Raporlar</li>
                    <li className="flex gap-3"><Check size={18} className="text-white/80 flex-shrink-0" /> Öncelikli Destek</li>
                </ul>
            </motion.div>

            {/* Enterprise */}
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="p-8 rounded-3xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-300 shadow-[0_20px_40px_-35px_rgba(15,23,42,0.35)]"
            >
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-xl">Kurumsal</h3>
                <p className="text-sm text-slate-500 mb-6">Büyük organizasyonlar için.</p>
                <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">İletişim</span>
                </div>
                <Link href="/contact" className="block w-full text-center py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    Satışla Görüş
                </Link>
                <ul className="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600 flex-shrink-0" /> Sınırsız Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600 flex-shrink-0" /> Özel Entegrasyonlar</li>
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600 flex-shrink-0" /> SLA & 7/24 Destek</li>
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600 flex-shrink-0" /> Kendi Sunucunuzda (On-Prem)</li>
                </ul>
            </motion.div>

        </div>

      </div>
    </section>
  );
};
