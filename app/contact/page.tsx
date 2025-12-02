'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'general', message: '' });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <LandingNav />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="py-20 container mx-auto px-4 sm:px-6 lg:px-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 max-w-2xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl font-black mb-6">Bize Ulaşın</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Renkflow ekibiyle iletişime geçmekten çekinmeyin. Sorularınıza en kısa sürede yanıt vereceğiz.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 bg-white dark:bg-gray-900 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800"
          >
            <h3 className="text-2xl font-bold mb-6">Bize Mesaj Gönderin</h3>
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Adınız Soyadınız</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow"
                    placeholder="Adınızı ve soyadınızı girin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">E-posta Adresiniz</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow"
                    placeholder="ornek@eposta.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Konu</label>
                <select className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow">
                  <option>Konu seçin</option>
                  <option>Teknik Destek</option>
                  <option>Satış</option>
                  <option>Genel Sorular</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mesajınız</label>
                <textarea
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow resize-y"
                  placeholder="Mesajınızı buraya yazın..."
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full md:w-auto bg-primary text-white font-bold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity"
              >
                Mesajı Gönder
              </motion.button>
            </form>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold mb-4">Diğer İletişim Yolları</h3>
              <div className="space-y-4">
                <a href="mailto:destek@renkflow.com" className="flex items-center gap-4 group">
                  <span className="material-symbols-outlined text-primary text-2xl">email</span>
                  <span className="text-gray-600 dark:text-gray-300 group-hover:text-primary transition-colors">
                    destek@renkflow.com
                  </span>
                </a>
                <a href="tel:+901234567890" className="flex items-center gap-4 group">
                  <span className="material-symbols-outlined text-primary text-2xl">call</span>
                  <span className="text-gray-600 dark:text-gray-300 group-hover:text-primary transition-colors">
                    +90 (123) 456 78 90
                  </span>
                </a>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 flex gap-4">
                {['twitter', 'linkedin', 'instagram'].map((social) => (
                  <a
                    key={social}
                    href="#"
                    className="p-2 rounded-full bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
                  >
                    <span className="material-symbols-outlined">share</span>
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.main>

      <LandingFooter />
    </div>
  );
}
