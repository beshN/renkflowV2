'use client';

import React, { useState } from 'react';
import { Check, Star, Quote } from 'lucide-react';
import { motion } from 'framer-motion';

export const Pricing: React.FC = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <section className="py-24 bg-white dark:bg-slate-950 relative overflow-hidden" id="pricing">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                Her ölçekteki işletme için <br/>
                <span className="text-blue-600">şeffaf fiyatlandırma.</span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                Gizli ücret yok. Taahhüt yok. İstediğiniz zaman iptal edin.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-medium ${!annual ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>Aylık</span>
                <button 
                    onClick={() => setAnnual(!annual)}
                    className="relative w-14 h-7 rounded-full bg-slate-200 dark:bg-slate-800 transition-colors p-1"
                >
                    <div 
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${annual ? 'translate-x-7' : 'translate-x-0'}`} 
                    />
                </button>
                <span className={`text-sm font-medium ${annual ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                    Yıllık <span className="text-green-600 text-xs font-bold bg-green-100 px-2 py-0.5 rounded-full ml-1">%20 İndirim</span>
                </span>
            </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Starter */}
            <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Başlangıç</h3>
                <p className="text-sm text-slate-500 mb-6">Küçük ekipler ve startup&apos;lar için.</p>
                <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">₺{annual ? '490' : '590'}</span>
                    <span className="text-slate-500">/ay</span>
                </div>
                <button className="w-full py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    Ücretsiz Dene
                </button>
                <ul className="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex gap-3"><Check size={18} className="text-blue-600" /> 5 Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-blue-600" /> Temel Otomasyon</li>
                    <li className="flex gap-3"><Check size={18} className="text-blue-600" /> 1GB Depolama</li>
                    <li className="flex gap-3"><Check size={18} className="text-slate-300" /> Gelişmiş Raporlar</li>
                </ul>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl bg-slate-900 text-white dark:bg-blue-600 relative transform md:-translate-y-4 shadow-xl">
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
                    EN POPÜLER
                </div>
                <h3 className="font-semibold mb-2">Profesyonel</h3>
                <p className="text-sm text-slate-300 mb-6">Büyüyen işletmeler için ideal.</p>
                <div className="mb-6">
                    <span className="text-4xl font-bold">₺{annual ? '990' : '1190'}</span>
                    <span className="text-slate-300">/ay</span>
                </div>
                <button className="w-full py-3 rounded-xl bg-blue-600 dark:bg-slate-900 text-white font-semibold hover:bg-blue-700 dark:hover:bg-slate-800 transition-colors shadow-lg shadow-blue-500/30">
                    Hemen Başla
                </button>
                <ul className="mt-8 space-y-4 text-sm text-slate-100">
                    <li className="flex gap-3"><Check size={18} className="text-blue-300 dark:text-blue-200" /> 20 Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-blue-300 dark:text-blue-200" /> Sınırsız Otomasyon</li>
                    <li className="flex gap-3"><Check size={18} className="text-blue-300 dark:text-blue-200" /> 50GB Depolama</li>
                    <li className="flex gap-3"><Check size={18} className="text-blue-300 dark:text-blue-200" /> Gelişmiş Raporlar</li>
                    <li className="flex gap-3"><Check size={18} className="text-blue-300 dark:text-blue-200" /> Öncelikli Destek</li>
                </ul>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Kurumsal</h3>
                <p className="text-sm text-slate-500 mb-6">Büyük organizasyonlar için.</p>
                <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">İletişim</span>
                </div>
                <button className="w-full py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    Satışla Görüş
                </button>
                <ul className="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex gap-3"><Check size={18} className="text-blue-600" /> Sınırsız Kullanıcı</li>
                    <li className="flex gap-3"><Check size={18} className="text-blue-600" /> Özel Entegrasyonlar</li>
                    <li className="flex gap-3"><Check size={18} className="text-blue-600" /> SLA & 7/24 Destek</li>
                    <li className="flex gap-3"><Check size={18} className="text-blue-600" /> Kendi Sunucunuzda (On-Prem)</li>
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
                        className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 relative"
                    >
                        <Quote className="absolute top-4 right-4 text-blue-600/10" size={48} />
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
