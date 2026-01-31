'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import Image from 'next/image';

const testimonials = [
  {
    name: 'Ahmet Yılmaz',
    role: 'Üretim Müdürü',
    company: 'ABC Mobilya',
    text: 'RenkFlow sayesinde sipariş takibimiz %80 hızlandı. Artık hiçbir detay gözden kaçmıyor. Ekip koordinasyonu çok daha kolay.',
    rating: 5,
    avatar: '/avatars/avatar-1.jpg'
  },
  {
    name: 'Zeynep Kaya',
    role: 'CEO',
    company: 'XYZ Tekstil',
    text: 'Ekip koordinasyonu çok kolaylaştı. Herkes ne yapacağını biliyor, e-posta trafiği bitti. Verimlilik %60 arttı.',
    rating: 5,
    avatar: '/avatars/avatar-2.jpg'
  },
  {
    name: 'Mehmet Demir',
    role: 'İşletme Sahibi',
    company: 'DEF Metal',
    text: 'Raporlama özellikleri harika. Hangi ürün ne kadar kar getiriyor artık net görüyorum. ROI 3 ayda kendini amorti etti.',
    rating: 5,
    avatar: '/avatars/avatar-3.jpg'
  }
];

export const TestimonialSection: React.FC = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Müşterilerimizin <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Başarı Hikayeleri</span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Binlerce işletme RenkFlow ile verimliliğini artırdı. Siz de onlara katılın.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative p-8 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-2xl transition-all duration-300 group"
            >
              {/* Quote Icon */}
              <Quote className="absolute top-6 right-6 text-blue-600/10 group-hover:text-blue-600/20 transition-colors" size={48} />
              
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Testimonial Text */}
              <p className="text-slate-600 dark:text-slate-300 mb-6 relative z-10 leading-relaxed">
                &quot;{testimonial.text}&quot;
              </p>

              {/* Author Info */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{testimonial.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{testimonial.role}, {testimonial.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 p-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
        >
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">500+</div>
            <div className="text-sm opacity-90">Mutlu Müşteri</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">%98</div>
            <div className="text-sm opacity-90">Memnuniyet Oranı</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">10K+</div>
            <div className="text-sm opacity-90">Tamamlanan Sipariş</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">24/7</div>
            <div className="text-sm opacity-90">Destek Hizmeti</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
