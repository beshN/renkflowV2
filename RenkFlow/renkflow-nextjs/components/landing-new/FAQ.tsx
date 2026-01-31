'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Search } from 'lucide-react';

export const FAQ: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
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

  const filteredFaqs = useMemo(() => {
    if (!searchTerm) return faqs;
    const term = searchTerm.toLowerCase();
    return faqs.filter(faq => 
      faq.q.toLowerCase().includes(term) || 
      faq.a.toLowerCase().includes(term)
    );
  }, [searchTerm, faqs]);

  return (
    <section className="py-24 bg-white dark:bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                Sıkça Sorulan Sorular
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">
                Aklınıza takılan soruların cevapları burada.
            </p>
            
            {/* Search Bar */}
            <div className="max-w-md mx-auto relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Soru ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
            </div>
        </div>

        <div className="space-y-4">
            {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq, i) => (
                    <Accordion key={i} question={faq.q} answer={faq.a} />
                ))
            ) : (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <p className="text-lg font-medium mb-2">Sonuç bulunamadı</p>
                    <p className="text-sm">Farklı bir arama terimi deneyin veya bizimle iletişime geçin.</p>
                </div>
            )}
        </div>

      </div>
    </section>
  );
};

const Accordion = ({ question, answer }: { question: string, answer: string }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
                <span className="font-semibold text-slate-900 dark:text-white">{question}</span>
                {isOpen ? <Minus size={20} className="text-blue-600" /> : <Plus size={20} className="text-slate-400" />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-50 dark:bg-slate-900/50"
                    >
                        <div className="p-6 pt-0 text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/50">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
