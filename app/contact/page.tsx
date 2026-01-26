'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Navbar } from '@/components/landing-new/Navbar';
import { Footer } from '@/components/landing-new/Footer';
import { useTheme } from '@/lib/context/ThemeContext';
import { Mail, MapPin, Phone, Send } from 'lucide-react';

export default function ContactPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar isDark={theme === 'dark'} toggleTheme={toggleTheme} />

      <main className="flex-grow pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          
          <div className="grid md:grid-cols-2 gap-16 items-start">
            
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
                İletişime Geçin
              </h1>
              <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
                Platform hakkındaki sorularınız, özel entegrasyon talepleriniz veya ortaklık teklifleriniz için bize ulaşın.
              </p>

              <div className="space-y-8">
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">E-posta</h3>
                    <p className="text-muted-foreground">info@renkflow.com</p>
                    <p className="text-muted-foreground">destek@renkflow.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Phone size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">Telefon</h3>
                    <p className="text-muted-foreground">+90 (212) 000 00 00</p>
                    <p className="text-sm text-muted-foreground mt-1">Hafta içi 09:00 - 18:00</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">Ofis</h3>
                    <p className="text-muted-foreground">Teknopark İstanbul</p>
                    <p className="text-muted-foreground">Sanayi Mah. Teknopark Bulvarı</p>
                    <p className="text-muted-foreground">Pendik / İstanbul</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-card border border-border rounded-3xl p-8 shadow-sm"
            >
              <h3 className="text-2xl font-bold text-foreground mb-6">Bize Yazın</h3>
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Adınız</label>
                    <input type="text" className="w-full h-12 rounded-xl bg-background border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary px-4 outline-none transition-all" placeholder="Adınız" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Soyadınız</label>
                    <input type="text" className="w-full h-12 rounded-xl bg-background border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary px-4 outline-none transition-all" placeholder="Soyadınız" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Konu</label>
                  <select className="w-full h-12 rounded-xl bg-background border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary px-4 outline-none transition-all">
                    <option>Satış & Teklif</option>
                    <option>Teknik Destek</option>
                    <option>Öneri & Geri Bildirim</option>
                    <option>Diğer</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mesajınız</label>
                  <textarea className="w-full h-32 rounded-xl bg-background border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary p-4 outline-none transition-all resize-none" placeholder="Size nasıl yardımcı olabiliriz?"></textarea>
                </div>

                <button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  Gönder <Send size={18} />
                </button>
              </form>
            </motion.div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
