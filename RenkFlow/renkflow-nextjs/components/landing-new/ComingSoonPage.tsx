'use client';

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Mail,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Star,
  Sparkles,
  Zap,
  Clock,
  Users,
  BarChart3,
  Package,
  Layers,
  Play,
  ChevronDown,
  Github,
  Twitter,
  Linkedin,
  Globe,
  Heart,
  Send,
  Bell,
  Rocket,
  Target,
  Award,
  TrendingUp,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DashboardPreview } from './DashboardPreview';

// Fixed launch date - 30 days from initial load (memoized to prevent re-renders)
const LAUNCH_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

// Countdown Timer Hook - uses fixed date to prevent infinite loops
const useCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = LAUNCH_DATE.getTime() - Date.now();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  return timeLeft;
};

// Animated Number Component
const AnimatedNumber = ({ value, label }: { value: number; label: string }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.5 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center"
  >
    <div className="relative">
      <div className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tabular-nums">
        {String(value).padStart(2, '0')}
      </div>
      <div className="absolute inset-0 blur-2xl bg-blue-500/30 -z-10" />
    </div>
    <span className="text-xs sm:text-sm text-slate-400 mt-2 uppercase tracking-widest font-medium">
      {label}
    </span>
  </motion.div>
);

// Feature Card Component
const FeatureCard = ({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay, duration: 0.5 }}
    whileHover={{ y: -8, scale: 1.02 }}
    className="group relative p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-200/20 dark:shadow-black/20 overflow-hidden"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    
    <div className="relative z-10">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
        <Icon size={24} />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  </motion.div>
);

// Floating Particle Component
const FloatingParticle = ({ delay, size, x, y }: { delay: number; size: number; x: string; y: string }) => (
  <motion.div
    className="absolute rounded-full bg-primary/20 dark:bg-primary/10"
    style={{ width: size, height: size, left: x, top: y }}
    animate={{
      y: [0, -30, 0],
      opacity: [0.3, 0.8, 0.3],
      scale: [1, 1.2, 1],
    }}
    transition={{
      duration: 4,
      delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);

export const ComingSoonPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  // Use countdown hook without arguments - uses fixed LAUNCH_DATE
  const timeLeft = useCountdown();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        toast.success(data.message || 'Bekleme listesine eklendiniz!');
        setEmail('');
      } else {
        setStatus('idle');
        toast.error(data.error || 'Bir hata oluştu.');
      }
    } catch {
      setStatus('idle');
      toast.error('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  }, [email]);

  const features = [
    {
      icon: Layers,
      title: 'Akıllı Sipariş Takibi',
      description: 'Siparişlerinizi anlık takip edin. Kanban, Liste ve Takvim görünümleri ile tam kontrol.',
    },
    {
      icon: BarChart3,
      title: 'Detaylı Analitik',
      description: 'Üretim performansı, verimlilik ve trendleri görselleştirin. Akıllı raporlar oluşturun.',
    },
    {
      icon: Zap,
      title: 'Güçlü Otomasyonlar',
      description: 'Tekrarlayan görevleri otomatikleştirin. Akıllı kurallar ile iş akışınızı hızlandırın.',
    },
    {
      icon: Users,
      title: 'Ekip İşbirliği',
      description: 'Gerçek zamanlı iletişim, görev atamaları ve bildirimler ile ekibinizi senkronize tutun.',
    },
    {
      icon: Package,
      title: 'Stok Yönetimi',
      description: 'Hammadde ve ürün stoklarını takip edin. Otomatik uyarılar ile stok sıkıntısı yaşamayın.',
    },
    {
      icon: ShieldCheck,
      title: 'Kurumsal Güvenlik',
      description: 'End-to-end şifreleme, rol bazlı yetkilendirme ve KVKK uyumlu altyapı.',
    },
  ];

  const stats = [
    { value: '500+', label: 'Beta Kullanıcısı', icon: Users },
    { value: '%40', label: 'Verimlilik Artışı', icon: TrendingUp },
    { value: '10K+', label: 'İşlenen Sipariş', icon: Package },
    { value: '4.9/5', label: 'Kullanıcı Puanı', icon: Star },
  ];

  if (!mounted) return null;

  return (
    <div 
      className="min-h-screen bg-[#FAFBFC] dark:bg-[#0A0A0F] overflow-hidden relative"
    >
      {/* Fixed Background - Consistent throughout the page */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gradient Orbs - Animated subtle movement */}
        <div 
          className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/15 via-cyan-500/10 to-transparent rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '8s' }}
        />
        <div 
          className="absolute top-[20%] -right-40 w-[500px] h-[500px] bg-gradient-to-bl from-violet-500/12 via-purple-500/8 to-transparent rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '10s', animationDelay: '2s' }}
        />
        <div 
          className="absolute -bottom-40 left-[20%] w-[600px] h-[600px] bg-gradient-to-t from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '12s', animationDelay: '4s' }}
        />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        
        {/* Floating Particles */}
        <FloatingParticle delay={0} size={8} x="10%" y="20%" />
        <FloatingParticle delay={1} size={6} x="85%" y="15%" />
        <FloatingParticle delay={2} size={10} x="70%" y="60%" />
        <FloatingParticle delay={0.5} size={5} x="20%" y="70%" />
        <FloatingParticle delay={1.5} size={7} x="50%" y="40%" />
        <FloatingParticle delay={2.5} size={4} x="90%" y="80%" />
      </div>

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            <div className="flex items-center gap-3">
              <Image
                src="/renkflow-logo-new.png"
                alt="RenkFlow"
                width={80}
                height={80}
                className="w-20 h-20 object-contain brightness-0 invert dark:brightness-100 dark:invert-0"
                priority
              />
              <span className="text-xl font-bold text-white">
                RenkFlow
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                <Sparkles size={14} />
                <span>Çok Yakında</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="hidden sm:flex"
                onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Bell size={16} className="mr-2" />
                Haberdar Ol
              </Button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center lg:text-left"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 mb-6"
              >
                <Rocket size={16} className="text-primary" />
                <span className="text-sm font-medium text-primary">Lansman Yaklaşıyor</span>
              </motion.div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6">
                <span className="text-white">Üretim Yönetiminde</span>
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                  Yeni Bir Dönem
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-400 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Siparişten teslimata, stoktan faturaya. Tüm üretim süreçlerinizi 
                tek bir platformda yönetin. <span className="text-white font-medium">Modern, hızlı ve güçlü.</span>
              </p>

              {/* Countdown Timer */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="flex justify-center lg:justify-start gap-4 sm:gap-8 mb-10"
              >
                <AnimatedNumber value={timeLeft.days} label="Gün" />
                <div className="text-3xl text-slate-600 self-start mt-4">:</div>
                <AnimatedNumber value={timeLeft.hours} label="Saat" />
                <div className="text-3xl text-slate-600 self-start mt-4">:</div>
                <AnimatedNumber value={timeLeft.minutes} label="Dakika" />
                <div className="text-3xl text-slate-600 self-start mt-4 hidden sm:block">:</div>
                <div className="hidden sm:block">
                  <AnimatedNumber value={timeLeft.seconds} label="Saniye" />
                </div>
              </motion.div>

              {/* Email Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                id="waitlist"
                className="max-w-md mx-auto lg:mx-0"
              >
                <AnimatePresence mode="wait">
                  {status === 'success' ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                    >
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="text-emerald-500" size={24} />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400">Harika!</p>
                        <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                          Lansmanda ilk siz haberdar olacaksınız.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <Input
                            type="email"
                            placeholder="E-posta adresiniz"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={status === 'loading'}
                            className="h-14 pl-12 pr-4 rounded-xl bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-400 shadow-lg shadow-black/20 focus:border-blue-500 focus:ring-blue-500/20"
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={status === 'loading'}
                          size="lg"
                          className="h-14 px-8 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                        >
                          {status === 'loading' ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Send size={18} className="mr-2" />
                              Haberdar Ol
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center justify-center lg:justify-start gap-2 text-xs text-muted-foreground">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        <span>Spam yok. İstediğiniz zaman abonelikten çıkın.</span>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Social Proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6"
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 border-2 border-background flex items-center justify-center text-white text-xs font-bold"
                      >
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-slate-400">
                    <span className="font-semibold text-white">500+</span> kişi bekliyor
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-1 text-sm font-medium text-white">4.9/5</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Content - Enhanced Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 50, rotateY: 15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="relative perspective-[2000px]"
            >
              <DashboardPreview isDark={isDark} />
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          <span className="text-xs text-muted-foreground">Keşfet</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ChevronDown size={20} className="text-muted-foreground" />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl text-center group hover:scale-105 transition-transform"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                <stat.icon className="mx-auto mb-3 text-primary" size={28} />
                <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Target size={16} />
              Özellikler
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              İşinizi büyütecek{' '}
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                her şey
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Modern üretim yönetimi için ihtiyacınız olan tüm araçlar tek bir platformda.
            </p>
          </motion.div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={i * 0.1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 overflow-hidden"
          >
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl" />
            
            <div className="relative z-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center"
              >
                <Award className="text-white" size={32} />
              </motion.div>
              
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Erken Erişim Avantajları
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
                Bekleme listesine katılanlara özel %50 indirim ve 3 ay ücretsiz premium üyelik.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-14 px-8 rounded-xl bg-white text-blue-600 hover:bg-white/90 shadow-xl"
                  onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Rocket className="mr-2" size={20} />
                  Hemen Katıl
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-14 px-8 rounded-xl text-white border border-white/30 hover:bg-white/10"
                >
                  <Play className="mr-2" size={20} />
                  Demo İzle
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/renkflow-logo-new.png"
                alt="RenkFlow"
                width={64}
                height={64}
                className="w-16 h-16 object-contain"
              />
              <span className="font-semibold text-foreground">RenkFlow</span>
            </div>
            
            <div className="flex items-center gap-4">
              <a href="#" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Linkedin size={20} />
              </a>
              <a href="#" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Github size={20} />
              </a>
              <a href="#" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Globe size={20} />
              </a>
            </div>
            
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              Made with <Heart size={14} className="text-red-500 fill-red-500" /> in Turkey
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
