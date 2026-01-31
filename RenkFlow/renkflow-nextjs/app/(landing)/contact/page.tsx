'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Mail, MapPin, Phone, Send } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ContactPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get('firstName') || '').trim();
    const lastName = String(formData.get('lastName') || '').trim();
    const topic = String(formData.get('topic') || '').trim();
    const message = String(formData.get('message') || '').trim();

    const params = new URLSearchParams({
      subject: `Renkflow İletişim: ${topic || 'Genel'}`,
      body: `Ad Soyad: ${firstName} ${lastName}\nKonu: ${topic}\n\nMesaj:\n${message}`,
    });
    window.location.href = `mailto:info@renkflow.com?${params.toString()}`;
    event.currentTarget.reset();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] dark:bg-slate-950 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(14,165,233,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.12),transparent_40%)]"
      />


      <main className="flex-grow pt-32 pb-20 px-6 md:px-12 relative z-10">
        <div className="max-w-6xl mx-auto">
          
          <div className="grid md:grid-cols-2 gap-16 items-start">
            
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                İletişim
              </span>
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
              className="bg-white/90 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 rounded-3xl p-8 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] backdrop-blur"
            >
              <h3 className="text-2xl font-bold text-foreground mb-6">Bize Yazın</h3>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Adınız</label>
                    <Input name="firstName" type="text" placeholder="Adınız" className="h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Soyadınız</label>
                    <Input name="lastName" type="text" placeholder="Soyadınız" className="h-12 rounded-xl" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Konu</label>
                  <select name="topic" className="input-professional h-12 rounded-xl">
                    <option>Satış & Teklif</option>
                    <option>Teknik Destek</option>
                    <option>Öneri & Geri Bildirim</option>
                    <option>Diğer</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Mesajınız</label>
                  <textarea
                    name="message"
                    className="input-professional h-32 rounded-xl resize-none"
                    placeholder="Size nasıl yardımcı olabiliriz?"
                  ></textarea>
                </div>

                <Button type="submit" size="lg" className="w-full h-12 rounded-xl">
                  Gönder <Send size={18} />
                </Button>
              </form>
            </motion.div>

          </div>
        </div>
      </main>

    </div>
  );
}
