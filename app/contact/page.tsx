'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

export default function Contact() {
  const [formRef, formInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general',
    message: ''
  });

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="flex items-center justify-between whitespace-nowrap border-b border-border-light dark:border-border-dark px-4 sm:px-6 lg:px-10 py-3 my-5 bg-card-light dark:bg-card-dark rounded-xl shadow-sm">
            <LandingNav />
          </header>

          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="py-10"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center text-center mb-12"
            >
              <h1 className="text-4xl md:text-5xl font-black">Bize Ulaşın</h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg font-normal max-w-2xl mx-auto mt-4">
                Renkflow ekibiyle iletişime geçmekten çekinmeyin. Sorularınıza en kısa sürede yanıt vereceğiz.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form */}
              <motion.div
                ref={formRef}
                initial={{ opacity: 0, x: -20 }}
                animate={formInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6 }}
                className="lg:col-span-2 bg-card-light dark:bg-card-dark p-8 rounded-xl shadow-sm border border-border-light dark:border-border-dark"
              >
                <h3 className="text-2xl font-bold mb-6">Bize Mesaj Gönderin</h3>
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="flex flex-col min-w-40 flex-1">
                      <p className="text-sm font-medium leading-normal pb-2">Adınız Soyadınız</p>
                      <input
                        type="text"
                        className="input-professional h-12"
                        placeholder="Adınızı ve soyadınızı girin"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </label>
                    
                    <label className="flex flex-col min-w-40 flex-1">
                      <p className="text-sm font-medium leading-normal pb-2">E-posta Adresiniz</p>
                      <input
                        type="email"
                        className="input-professional h-12"
                        placeholder="ornek@eposta.com"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-sm font-medium leading-normal pb-2">Konu</p>
                    <select 
                      className="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-md text-text-light dark:text-text-dark focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark h-12 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-4 text-base font-normal leading-normal transition-shadow"
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    >
                      <option value="general">Konu seçin</option>
                      <option value="technical">Teknik Destek</option>
                      <option value="sales">Satış</option>
                      <option value="general">Genel Sorular</option>
                    </select>
                  </label>

                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-sm font-medium leading-normal pb-2">Mesajınız</p>
                    <textarea
                      className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-md text-text-light dark:text-text-dark focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark min-h-36 placeholder:text-slate-400 dark:placeholder:text-slate-500 p-4 text-base font-normal leading-normal transition-shadow"
                      placeholder="Mesajınızı buraya yazın..."
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                    />
                  </label>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="flex min-w-[120px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-md h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] w-full md:w-auto hover:opacity-90 transition-opacity"
                  >
                    Mesajı Gönder
                  </motion.button>
                </form>
              </motion.div>

              {/* Contact Info */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="space-y-8"
              >
                <div className="bg-card-light dark:bg-card-dark p-6 rounded-xl shadow-sm border border-border-light dark:border-border-dark">
                  <h3 className="text-xl font-bold mb-4">Diğer İletişim Yolları</h3>
                  <div className="space-y-4">
                    <a href="mailto:destek@renkflow.com" className="flex items-center gap-4 group">
                      <span className="material-symbols-outlined text-primary text-2xl">email</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">
                        destek@renkflow.com
                      </span>
                    </a>
                    <a href="tel:+901234567890" className="flex items-center gap-4 group">
                      <span className="material-symbols-outlined text-primary text-2xl">call</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">
                        +90 (123) 456 78 90
                      </span>
                    </a>
                  </div>

                  <div className="mt-6 pt-6 border-t border-border-light dark:border-border-dark flex gap-4">
                    {['twitter', 'linkedin', 'github'].map((social) => (
                      <motion.a
                        key={social}
                        href="#"
                        whileHover={{ scale: 1.1 }}
                        className="p-2 rounded-full bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
                      >
                        <span className="material-symbols-outlined">share</span>
                      </motion.a>
                    ))}
                  </div>
                </div>

                <div className="bg-primary/10 dark:bg-primary/20 p-6 rounded-xl text-center">
                  <h3 className="text-xl font-bold mb-2 text-text-light dark:text-text-dark">Bir sorunuz mu var?</h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Cevabı Sıkça Sorulan Sorular sayfamızda bulabilirsiniz.
                  </p>
                  <a 
                    href="#"
                    className="inline-flex items-center justify-center gap-2 min-w-[84px] cursor-pointer rounded-lg h-11 px-5 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:opacity-90 transition-opacity"
                  >
                    <span>SSS Sayfasına Git</span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </a>
                </div>
              </motion.div>
            </div>
          </motion.main>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
