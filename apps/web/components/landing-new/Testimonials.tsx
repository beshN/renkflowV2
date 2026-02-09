'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

export const Testimonials: React.FC = () => {
  const testimonials = [
    {
      name: 'Ahmet Yılmaz',
      role: 'Üretim Müdürü @ MetalAŞ',
      content: 'RenkFlow öncesinde siparişleri Excel ile takip ediyorduk. Şimdi her şey otomatik. Ekibimin verimliliği %40 arttı.',
      avatar: '/avatars/1.png' // Would be replaced by real or generated avatar
    },
    {
      name: 'Selin Demir',
      role: 'CEO @ TechPack Ambalaj',
      content: 'Müşteri taleplerini yönetmek artık çocuk oyuncağı. Özellikle Dashboard ekranındaki anlık veriler karar alma sürecimi hızlandırdı.',
      avatar: '/avatars/2.png'
    },
    {
      name: 'Mehmet Bey',
      role: 'Operasyon Direktörü @ Lojistik360',
      content: 'SaaS dünyasında gördüğüm en temiz arayüz. Karmaşık ERP sistemlerinden kurtulup RenkFlow\'a geçtiğimiz için çok mutluyuz.',
      avatar: '/avatars/3.png'
    }
  ];

  return (
    <section className="py-24 bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
        
        <div className="text-center mb-16">
            <span className="text-blue-600 font-semibold text-sm tracking-wider uppercase mb-2 block">Başarı Hikayeleri</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                Müşterilerimiz Neler Söylüyor?
            </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
                <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-8 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 relative"
                >
                    <Quote className="absolute top-8 right-8 text-blue-100 dark:text-blue-900/30" size={48} />
                    
                    <div className="flex gap-1 text-amber-400 mb-6">
                        {[...Array(5)].map((_, j) => <Star key={j} size={16} fill="currentColor" />)}
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 mb-8 relative z-10 leading-relaxed">
                        &quot;{t.content}&quot;
                    </p>

                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500">
                            {t.name[0]}
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</h4>
                            <p className="text-xs text-slate-500">{t.role}</p>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>

      </div>
    </section>
  );
};
