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
    <section id="faq" className="py-24 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
            <motion.h2 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4"
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
            className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-300"
        >
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
                <span className="font-semibold text-slate-900 dark:text-white">{question}</span>
                {isOpen ? <Minus size={20} className="text-blue-600 flex-shrink-0" /> : <Plus size={20} className="text-slate-400 flex-shrink-0" />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <div className="p-6 pt-0 text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700/50">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
