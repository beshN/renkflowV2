'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Mail,
  CheckCircle2,
  ShieldCheck,
  Star,
  Zap,
  Users,
  BarChart3,
  Package,
  Layers,
  ChevronDown,
  Github,
  Twitter,
  Linkedin,
  Send,
  Rocket,
  TrendingUp,
  Plus,
  Minus,
  ArrowRight,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DashboardPreview } from './DashboardPreview';

// --- Sub-components (stateless, outside main component) ---

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
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ delay, duration: 0.4 }}
    className="group relative p-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-300 h-full"
  >
    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 mb-5 group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-slate-900 transition-colors duration-300">
      <Icon size={20} />
    </div>
    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
      {title}
    </h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
      {description}
    </p>
  </motion.div>
);

const FAQItem = ({ question, answer, isOpen, onToggle }: {
  question: string; answer: string; isOpen: boolean; onToggle: () => void;
}) => (
  <div className="border-b border-slate-200 dark:border-slate-800 last:border-b-0">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-5 text-left group"
    >
      <span className="text-[15px] font-medium text-slate-900 dark:text-white pr-8 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">{question}</span>
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${isOpen ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rotate-0' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
        {isOpen ? <Minus size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
      </div>
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <p className="pb-5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed pr-12">
            {answer}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const TestimonialCard = ({ name, role, company, content, avatar, delay }: {
  name: string; role: string; company: string; content: string; avatar: string; delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ delay, duration: 0.4 }}
    className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
  >
    <div className="flex gap-1 mb-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
      ))}
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">{content}</p>
    <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 text-xs font-semibold">
        {avatar}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-900 dark:text-white">{name}</div>
        <div className="text-xs text-slate-400">{role}, {company}</div>
      </div>
    </div>
  </motion.div>
);

// --- Main Component ---

export const ComingSoonPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Lütfen e-posta adresinizi girin.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { toast.error('Lütfen geçerli bir e-posta adresi girin.'); return; }
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
    { icon: Layers, title: 'Sipariş Takibi', description: 'Siparişlerinizi Kanban, Liste ve Takvim görünümleri ile anlık takip edin.' },
    { icon: BarChart3, title: 'Detaylı Analitik', description: 'Üretim performansı, verimlilik ve trendleri tek panelden görselleştirin.' },
    { icon: Zap, title: 'Otomasyon', description: 'Tekrarlayan görevleri otomatikleştirin, iş akışınızı hızlandırın.' },
    { icon: Users, title: 'Ekip İşbirliği', description: 'Gerçek zamanlı görev atamaları ve bildirimler ile ekibinizi senkronize tutun.' },
    { icon: Package, title: 'Stok Yönetimi', description: 'Hammadde ve ürün stoklarını takip edin, otomatik uyarılar alın.' },
    { icon: ShieldCheck, title: 'Kurumsal Güvenlik', description: 'End-to-end şifreleme, rol bazlı yetkilendirme ve KVKK uyumlu altyapı.' },
  ];

  const stats = [
    { value: '500+', label: 'Beta Kullanıcısı' },
    { value: '%40', label: 'Verimlilik Artışı' },
    { value: '10K+', label: 'İşlenen Sipariş' },
    { value: '4.9/5', label: 'Kullanıcı Puanı' },
  ];

  const testimonials = [
    { name: 'Ahmet Yılmaz', role: 'Üretim Müdürü', company: 'Tekno Mobilya', content: 'Beta sürecinde sipariş takip süremiz %60 azaldı. Artık hangi siparişin hangi aşamada olduğunu anlık görebiliyoruz.', avatar: 'AY' },
    { name: 'Elif Demir', role: 'Genel Müdür', company: 'Demir Tekstil', content: 'Stok yönetimi eskiden kabustu. RenkFlow ile hammadde siparişlerini otomatik uyarılarla yönetiyoruz, fire oranımız %35 düştü.', avatar: 'ED' },
    { name: 'Murat Kaya', role: 'Operasyon Direktörü', company: 'Kaya Metal', content: 'Ekip koordinasyonu inanılmaz kolaylaştı. Gerçek zamanlı görev atamaları ile iletişim kopukluğu sona erdi.', avatar: 'MK' },
  ];

  const faqs = [
    { question: 'RenkFlow ne zaman kullanıma açılacak?', answer: 'RenkFlow şu anda aktif beta sürecinde. Bekleme listesine katılan kullanıcılarımıza öncelikli erişim sağlıyoruz. Genel lansmanımız yakında gerçekleşecek.' },
    { question: 'Hangi sektörlere uygun?', answer: 'Mobilya, tekstil, metal işleme, gıda üretimi, plastik enjeksiyon ve daha birçok üretim sektörüne uygun modüler bir platformdur.' },
    { question: 'Mevcut sistemlerimle entegre olabilir mi?', answer: 'Evet. REST API ve webhook desteği ile mevcut ERP, muhasebe ve e-ticaret sistemlerinizle entegre çalışabilir.' },
    { question: 'Verilerim güvende mi?', answer: 'End-to-end şifreleme, rol bazlı yetkilendirme, otomatik yedekleme ve KVKK uyumlu altyapı ile verileriniz en yüksek güvenlik standartlarında korunur.' },
    { question: 'Ücretsiz deneme süreci var mı?', answer: 'Bekleme listesine katılan tüm kullanıcılarımıza 3 ay ücretsiz premium üyelik ve %50 lansman indirimi sunuyoruz.' },
  ];

  const footerQuickLinks = [
    { label: 'Bekleme Listesi', href: '#waitlist' },
    { label: 'Özellikler', href: '#features' },
    { label: 'SSS', href: '#faq' },
  ];

  const footerSocialLinks = [
    { icon: Twitter, href: 'https://twitter.com/renkflow', label: 'Twitter' },
    { icon: Linkedin, href: 'https://linkedin.com/company/renkflow', label: 'LinkedIn' },
    { icon: Github, href: 'https://github.com/renkflow', label: 'GitHub' },
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0B0F] relative">

      {/* Subtle background — single soft gradient, no particles/noise */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[70%] h-[70%] bg-gradient-to-bl from-blue-50 dark:from-blue-950/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-[30%] -left-[15%] w-[50%] h-[50%] bg-gradient-to-tr from-slate-100 dark:from-slate-900/40 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 dark:bg-[#0B0B0F]/80 backdrop-blur-lg border-b border-slate-200/60 dark:border-slate-800/60'
          : 'bg-transparent'
      }`}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="flex items-center justify-between h-16">
            <Image
              src="/renkflow-logo-new.png"
              alt="RenkFlow"
              width={140}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Çok Yakında
              </span>
              <Button
                size="sm"
                className="h-9 px-4 text-xs rounded-lg"
                onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Haberdar Ol
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">

            {/* Left */}
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Erken Erişim Açık
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-6 text-slate-900 dark:text-white"
              >
                Üretim yönetiminde
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
                  yeni standart.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg text-slate-500 dark:text-slate-400 mb-10 max-w-lg mx-auto lg:mx-0 leading-relaxed"
              >
                Siparişten teslimata, stoktan faturaya — tüm üretim süreçlerinizi
                tek bir platformda yönetin.
              </motion.p>

              {/* Email Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                id="waitlist"
                className="max-w-md mx-auto lg:mx-0"
              >
                <AnimatePresence mode="wait">
                  {status === 'success' ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                    >
                      <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" size={20} />
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        Harika! Lansmanda ilk siz haberdar olacaksınız.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                    >
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <Input
                            type="email"
                            placeholder="E-posta adresiniz"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={status === 'loading'}
                            className="h-11 pl-10 pr-4 rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={status === 'loading'}
                          className="h-11 px-5 rounded-lg text-sm"
                        >
                          {status === 'loading' ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Send size={14} className="mr-1.5" />
                              Katıl
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="flex items-center justify-center lg:justify-start gap-1.5 text-xs text-slate-400 mt-3">
                        <ShieldCheck size={12} className="text-slate-400" />
                        Spam yok. İstediğiniz zaman abonelikten çıkın.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Social Proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex -space-x-2">
                    {['AY', 'ED', 'MK', 'SK', 'BT'].map((initials, i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-[#0B0B0F] flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                      >
                        {initials}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-white">500+</strong> kişi bekliyor
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={13} className="fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-1 text-sm text-slate-500 dark:text-slate-400 font-medium">4.9</span>
                </div>
              </motion.div>
            </div>

            {/* Right — Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="hidden lg:block relative"
            >
              <DashboardPreview isDark={isDark} />
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 cursor-pointer"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          <span className="text-[11px] text-slate-400">Keşfet</span>
          <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
            <ChevronDown size={16} className="text-slate-400" />
          </motion.div>
        </motion.div>
      </section>

      {/* ─── STATS ─── */}
      <section className="relative py-16 border-y border-slate-100 dark:border-slate-800/60">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <div className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-1 tabular-nums">{stat.value}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="relative py-24">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              İhtiyacınız olan her şey, tek platformda.
            </h2>
            <p className="text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Modern üretim yönetimi için tasarlanmış kapsamlı araç seti.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={i * 0.06}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="relative py-24 bg-slate-50 dark:bg-slate-900/30">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              3 adımda başlayın
            </h2>
            <p className="text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Üretim süreçlerinizi dijitalleştirmek hiç bu kadar kolay olmamıştı.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-10 relative">
            <div className="hidden md:block absolute top-8 left-[18%] right-[18%] h-px bg-slate-200 dark:bg-slate-700" />
            {[
              { step: '1', title: 'Kayıt Olun', description: 'E-posta adresinizi girin ve bekleme listesine katılın.', icon: Mail },
              { step: '2', title: 'Kurulumu Yapın', description: 'Şirket bilgilerinizi girin, ekibinizi davet edin.', icon: Layers },
              { step: '3', title: 'Yönetmeye Başlayın', description: 'Tüm süreçlerinizi tek panelden takip edin.', icon: TrendingUp },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative text-center"
              >
                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center relative z-10">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{item.step}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[240px] mx-auto">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="relative py-24">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Beta kullanıcılarımız ne diyor?
            </h2>
            <p className="text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Üretim profesyonellerinden geri bildirimler.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <TestimonialCard key={t.name} {...t} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="relative py-24 bg-slate-50 dark:bg-slate-900/30">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Sıkça sorulan sorular
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-6"
          >
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === i}
                onToggle={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative p-10 sm:p-14 rounded-2xl bg-slate-900 dark:bg-white overflow-hidden text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-cyan-500/10" />

            <div className="relative z-10">
              <div className="w-12 h-12 mx-auto mb-6 rounded-xl bg-white/10 dark:bg-slate-900/10 flex items-center justify-center">
                <Rocket className="text-white dark:text-slate-900" size={24} />
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-white dark:text-slate-900 mb-3">
                Erken Erişim Avantajları
              </h2>
              <p className="text-slate-400 dark:text-slate-500 mb-8 max-w-md mx-auto">
                Bekleme listesine katılanlara özel ayrıcalıklar.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                {['%50 lansman indirimi', '3 ay ücretsiz premium', 'Öncelikli destek'].map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 dark:bg-slate-900/10 text-white dark:text-slate-900 text-xs font-medium">
                    <CheckCircle2 size={12} />
                    {b}
                  </span>
                ))}
              </div>

              <Button
                size="lg"
                className="h-11 px-6 rounded-lg bg-white text-slate-900 hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <ArrowRight size={16} className="mr-2" />
                Hemen Katıl
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-12">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div className="sm:col-span-2 lg:col-span-1">
              <Image
                src="/renkflow-logo-new.png"
                alt="RenkFlow"
                width={120}
                height={36}
                className="h-7 w-auto object-contain mb-4"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[220px]">
                Siparişten teslimata, tüm üretim süreçlerinizi tek platformda yönetin.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Hızlı Erişim</h4>
              <ul className="space-y-2">
                {footerQuickLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">İletişim</h4>
              <a
                href="mailto:info@renkflow.com"
                className="inline-flex text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                info@renkflow.com
              </a>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Lansmanda ürün sayfaları açılacak.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Takip Edin</h4>
              <div className="flex items-center gap-2">
                {footerSocialLinks.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} RenkFlow. Tüm hakları saklıdır.</p>
            <a href="/sitemap.xml" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Site Haritası
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
