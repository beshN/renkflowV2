'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Mail, ShieldCheck, CheckCircle2, ChevronRight, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { DashboardPreview } from './DashboardPreview';
import { useTheme } from '@/lib/context/ThemeContext';

export const Hero: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
        toast.error('Lütfen e-posta adresinizi girin.');
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
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      
      {/* Aurora Background Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[100px]" />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-6 pt-32 pb-20 lg:pt-48 lg:pb-32">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
            
            {/* Left Content */}
            <motion.div 
                className="flex-1 max-w-2xl text-center lg:text-left z-20"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
            >
                {/* Badge */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border backdrop-blur-sm mb-8 mx-auto lg:mx-0"
                >
                    <span className="flex h-2 w-2 rounded-full bg-blue-500 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    </span>
                    <span className="text-sm font-medium text-foreground/80">RenkFlow v2.0 Erken Erişim</span>
                </motion.div>

                {/* Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
                    Üretim Yönetiminde <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
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
                         >
                            <CheckCircle2 size={24} />
                            <div className="text-left">
                                <p className="font-semibold">Harika seçim!</p>
                                <p className="text-sm opacity-90">Bekleme listesine eklendiniz.</p>
                            </div>
                         </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-grow">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground">
                                    <Mail size={18} />
                                </div>
                                <input 
                                    type="email" 
                                    placeholder="E-posta adresiniz" 
                                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={status === 'loading'}
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={status === 'loading'}
                                className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-70 whitespace-nowrap"
                            >
                                {status === 'loading' ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Haber Ver <ArrowRight size={18} /></>
                                )}
                            </button>
                        </form>
                    )}
                    <div className="mt-4 flex items-center justify-center lg:justify-start gap-2 text-xs text-muted-foreground">
                        <ShieldCheck size={14} className="text-green-500" />
                        <span>Verileriniz şifrelenir ve korunur. Spam yok.</span>
                    </div>
                </div>

                {/* Companies / Social Proof (Optional Placeholder) */}
                <div className="mt-12 pt-8 border-t border-border/50 hidden lg:block">
                   <p className="text-sm font-medium text-muted-foreground mb-4">Modern işletmelerin tercihi</p>
                   <div className="flex gap-6 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-md"></div>
                        <span className="font-bold text-lg text-foreground/50">TechCorp</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-500/20 rounded-md"></div>
                        <span className="font-bold text-lg text-foreground/50">InduSys</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-500/20 rounded-md"></div>
                        <span className="font-bold text-lg text-foreground/50">Logistix</span>
                      </div>
                   </div>
                </div>
            </motion.div>

            {/* Right Visual - 3D Dashboard */}
            <motion.div 
                className="flex-1 w-full max-w-2xl lg:max-w-none relative perspective-[2000px]"
                initial={{ opacity: 0, x: 50, rotateY: 20 }}
                animate={{ opacity: 1, x: 0, rotateY: -5 }}
                transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* Floating Elements (Decorations) */}
                <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-12 -right-8 z-30 p-4 rounded-2xl bg-card shadow-xl border border-border hidden lg:block backdrop-blur-md bg-opacity-90"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Sipariş Tamamlandı</p>
                            <p className="text-sm font-bold text-foreground">₺24,500</p>
                        </div>
                    </div>
                </motion.div>

                {/* Main Dashboard Preview */}
                <div className="relative z-20">
                    <DashboardPreview isDark={isDark} />
                </div>
                
                 {/* 3D Floor Shadow */}
                 <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[90%] h-12 bg-black/20 blur-xl rounded-[100%] pointer-events-none transform rotate-x-60" />

            </motion.div>
        </div>
      </div>
    </div>
  );
};
