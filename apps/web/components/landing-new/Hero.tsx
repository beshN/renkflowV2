'use client';

import React, { useState, useCallback } from 'react';
import { Mail, ShieldCheck, CheckCircle2, ArrowRight, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DashboardPreview } from './DashboardPreview';

export const Hero: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Email validation
    if (!email) {
        toast.error('Lütfen e-posta adresinizi girin.');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        toast.error('Lütfen geçerli bir e-posta adresi girin.');
        return;
    }
    
    setStatus('loading');

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        toast.success(data.message);
        setEmail('');
      } else {
        setStatus('idle');
        toast.error(data.error || 'Bir hata oluştu.');
      }
    } catch (error) {
      setStatus('idle');
      toast.error('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  }, [email]);

  return (
    <section className="relative min-h-[calc(100svh-4.5rem)] w-full overflow-hidden bg-[#f7f8fb] dark:bg-slate-950" aria-label="Hero Section">
      
      {/* Aurora Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-gradient-to-tr from-sky-500/15 to-emerald-500/15 blur-[80px] animate-blob will-change-transform dark:mix-blend-soft-light" />
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-bl from-blue-500/15 to-sky-500/15 blur-[80px] animate-blob animation-delay-2000 will-change-transform dark:mix-blend-soft-light" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-gradient-to-t from-emerald-400/15 to-sky-400/15 blur-[60px] animate-blob animation-delay-4000 will-change-transform dark:mix-blend-soft-light" />
      </div>

      <div className="relative z-10 rf-page-wrap pt-24 pb-16 lg:pt-32 lg:pb-20">
        <div className="rf-hero-grid">
            
            {/* Left Content */}
            <motion.div
                className="w-full text-center lg:text-left z-20"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                {/* Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1]">
                    Üretim Yönetiminde <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-emerald-500 dark:from-sky-400 dark:to-emerald-400">
                        Yeni Bir Çağ.
                    </span>
                </h1>

                <p className="text-lg sm:text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl mx-auto lg:mx-0">
                    Siparişten teslimata, stoktan faturaya. Karmaşık süreçleri basitleştiren, işletmenizle büyüyen modern çözüm.
                </p>

                {/* Email Form */}
                <div className="max-w-md mx-auto lg:mx-0">
                    {status === 'success' ? (
                         <motion.div
                             initial={{ opacity: 0, scale: 0.95 }}
                             animate={{ opacity: 1, scale: 1 }}
                             className="flex items-center gap-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400"
                             role="alert"
                         >
                            <CheckCircle2 size={24} aria-hidden="true" />
                            <div className="text-left">
                                <p className="font-semibold">Harika seçim!</p>
                                <p className="text-sm opacity-90">Bekleme listesine eklendiniz.</p>
                            </div>
                         </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-grow">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                                    <Mail size={18} aria-hidden="true" />
                                </div>
                                <Input
                                    type="email"
                                    placeholder="E-posta adresiniz"
                                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/90 dark:bg-slate-900/70 shadow-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={status === 'loading'}
                                    aria-label="E-posta adresiniz"
                                    required
                                />
                            </div>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={status === 'loading'}
                                className="h-12 rounded-xl px-6 shadow-[0_18px_30px_-18px_rgba(184,116,68,0.7)]"
                                aria-label="Bekleme listesine katıl"
                            >
                                {status === 'loading' ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                                ) : (
                                    <>Haber Ver <ArrowRight size={18} aria-hidden="true" /></>
                                )}
                            </Button>
                        </form>
                    )}
                    <div className="mt-4 flex items-center justify-center lg:justify-start gap-2 text-xs text-muted-foreground">
                        <ShieldCheck size={14} className="text-green-500" aria-hidden="true" />
                        <span>Verileriniz şifrelenir ve korunur. Spam yok.</span>
                    </div>
                </div>

                {/* Trust Badges */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground"
                >
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {[1,2,3,4].map(i => (
                                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 border-2 border-background flex items-center justify-center text-white text-xs font-bold">
                                    {String.fromCharCode(64 + i)}
                                </div>
                            ))}
                        </div>
                        <span className="font-medium">500+ mutlu kullanıcı</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                            <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />
                        ))}
                        <span className="ml-1 font-medium">4.9/5 puan</span>
                    </div>
                </motion.div>
            </motion.div>

            {/* Right Visual - 3D Dashboard */}
            <motion.div
                className="w-full lg:-mr-[3vw] 2xl:-mr-[4vw] relative perspective-[2000px] flex justify-end"
                initial={{ opacity: 0, x: 50, rotateY: 20 }}
                animate={{ opacity: 1, x: 0, rotateY: -5 }}
                transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* Main Dashboard Preview */}
                <div className="relative z-20 w-full lg:w-[min(62vw,980px)] max-w-[980px]">
                    <DashboardPreview isDark={isDark} />
                </div>
                
                 {/* 3D Floor Shadow */}
                 <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[90%] h-12 bg-black/20 blur-xl rounded-[100%] pointer-events-none" style={{ transform: 'rotateX(60deg)' }} />

            </motion.div>
        </div>

      </div>
    </section>
  );
};
