'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const faqs = [
    {
      q: 'RenkFlow kimler için uygun?',
      a: 'RenkFlow, üretim, montaj veya sipariş takibi yapan KOBİ\'ler ve büyük işletmeler için tasarlanmıştır. Özellikle karmaşık iş akışlarını basitleştirmek isteyen ekipler için idealdir.'
    },
    {
      q: 'Kurulum gerektiriyor mu?',
      a: 'Hayır, RenkFlow %100 bulut tabanlıdır. Hiçbir kurulum yapmadan, sadece tarayıcınızdan giriş yaparak kullanmaya başlayabilirsiniz.'
    },
    {
      q: 'Verilerim güvende mi?',
      a: 'Kesinlikle. Verileriniz endüstri standardı 256-bit SSL şifreleme ile korunur. Ayrıca düzenli olarak yedeklenir ve ISO sertifikalı sunucularda barındırılır.'
    },
    {
      q: 'Mevcut verilerimi aktarabilir miyim?',
      a: 'Evet, Excel veya CSV formatındaki müşteri ve ürün listelerinizi RenkFlow\'a tek tıkla aktarabilirsiniz. Entegrasyon ekibimiz de size yardımcı olmaktan mutluluk duyar.'
    },
    {
      q: 'İstediğim zaman iptal edebilir miyim?',
      a: 'Elbette. Hiçbir taahhüt yoktur. Memnun kalmazsanız üyeliğinizi istediğiniz an sonlandırabilirsiniz. Verilerinizi dışa aktarıp alabilirsiniz.'
    }
  ];

  return (
    <section id="faq" className="py-24 bg-slate-50/70 dark:bg-slate-900/50 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(14,165,233,0.12),transparent_40%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.12),transparent_40%)]"
      />
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 relative z-10">
        
        <div className="text-center mb-16">
            <motion.p 
               initial={{ opacity: 0, y: 14 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
                Destek
            </motion.p>
            <motion.h2 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               className="mt-6 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4"
            >
                Sıkça Sorulan Sorular
            </motion.h2>
            <motion.p 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ delay: 0.1 }}
               className="text-slate-600 dark:text-slate-400"
            >
                Aklınıza takılan soruların cevapları burada.
            </motion.p>
        </div>

        <div className="space-y-4">
            {faqs.map((faq, i) => (
                <Accordion key={i} question={faq.q} answer={faq.a} index={i} />
            ))}
        </div>

      </div>
    </section>
  );
};

const Accordion = ({ question, answer, index }: { question: string, answer: string, index: number }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="border border-slate-200/70 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/90 dark:bg-slate-900/70 shadow-[0_16px_35px_-30px_rgba(15,23,42,0.4)] hover:shadow-[0_24px_50px_-32px_rgba(14,165,233,0.4)] transition-all duration-300 backdrop-blur"
        >
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors"
            >
                <span className="font-semibold text-slate-900 dark:text-white">{question}</span>
                {isOpen ? <Minus size={20} className="text-sky-600 flex-shrink-0" /> : <Plus size={20} className="text-slate-400 flex-shrink-0" />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <div className="p-6 pt-0 text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100/80 dark:border-slate-700/50">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
