'use client';

import React, { useState } from 'react';
import { Check, Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export const Pricing: React.FC = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <section className="py-24 bg-white/90 dark:bg-slate-950 relative overflow-hidden" id="pricing">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(14,165,233,0.12),transparent_45%),radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.1),transparent_45%)]"
      />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
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
                <Link href="/signup" className="block">
                  <Button variant="outline" size="lg" className="w-full">
                    Ücretsiz Dene
                  </Button>
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
                <Link href="/signup" className="block">
                  <Button variant="ghost" size="lg" className="w-full bg-white text-slate-900 hover:bg-slate-100">
                    Hemen Başla
                  </Button>
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
                <Link href="/contact" className="block">
                  <Button variant="outline" size="lg" className="w-full">
                    Satışla Görüş
                  </Button>
                </Link>
                <ul className="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600" /> Sınırsız Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600" /> Özel Entegrasyonlar</li>
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600" /> SLA & 7/24 Destek</li>
                    <li className="flex gap-3"><Check size={18} className="text-emerald-600" /> Kendi Sunucunuzda (On-Prem)</li>
                </ul>
            </div>

        </div>

        {/* Testimonials */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-24"
        >
            <h3 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-12">
                Müşterilerimiz Ne Diyor?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    {
                        name: 'Ahmet Yılmaz',
                        role: 'Üretim Müdürü, ABC Mobilya',
                        text: 'RenkFlow sayesinde sipariş takibimiz %80 hızlandı. Artık hiçbir detay gözden kaçmıyor.',
                        rating: 5
                    },
                    {
                        name: 'Zeynep Kaya',
                        role: 'CEO, XYZ Tekstil',
                        text: 'Ekip koordinasyonu çok kolaylaştı. Herkes ne yapacağını biliyor, e-posta trafiği bitti.',
                        rating: 5
                    },
                    {
                        name: 'Mehmet Demir',
                        role: 'İşletme Sahibi, DEF Metal',
                        text: 'Raporlama özellikleri harika. Hangi ürün ne kadar kar getiriyor artık net görüyorum.',
                        rating: 5
                    }
                ].map((testimonial, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="p-6 rounded-2xl bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 relative shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]"
                    >
                        <Quote className="absolute top-4 right-4 text-sky-600/10" size={48} />
                        <div className="flex gap-1 mb-4">
                            {[...Array(testimonial.rating)].map((_, i) => (
                                <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                            ))}
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mb-6 relative z-10">
                            &quot;{testimonial.text}&quot;
                        </p>
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{testimonial.name}</p>
                            <p className="text-sm text-slate-500">{testimonial.role}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>

      </div>
    </section>
  );
};
