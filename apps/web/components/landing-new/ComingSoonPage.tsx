'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import dynamic from 'next/dynamic';
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
import { WaitlistNavbar } from './WaitlistNavbar';

const DashboardPreview = dynamic(
  () => import('./DashboardPreview').then((mod) => ({ default: mod.DashboardPreview })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] xl:h-[560px] 2xl:h-[600px] rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/70 animate-pulse" />
    ),
  }
);

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
    className="group relative p-6 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-blue-900/10 transition-all duration-300 h-full"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />
    <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform duration-300 relative z-10">
      <Icon size={20} />
    </div>
    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2 relative z-10">
      {title}
    </h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">
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
      className="w-full flex items-center justify-between py-4 text-left group"
    >
      <span className="text-[15px] font-medium text-slate-800 dark:text-slate-200 pr-8 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{question}</span>
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-blue-600 text-white rotate-0' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
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
          <p className="pb-4 text-sm text-slate-500 dark:text-slate-400 leading-relaxed pr-12">
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
    className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
  >
    <div className="flex gap-1 mb-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
      ))}
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5 italic">"{content}"</p>
    <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
        {avatar}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{role}, {company}</div>
      </div>
    </div>
  </motion.div>
);

// --- Main Component ---

export const ComingSoonPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [mounted, setMounted] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => { setMounted(true); }, []);

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
    { icon: Layers, title: 'Akıllı Takip', description: 'Siparişlerinizi Kanban, Liste ve Takvim görünümleri ile 360° yönetin.' },
    { icon: BarChart3, title: 'Canlı Analitik', description: 'Üretim darboğazlarını anlık tespit edin, veriye dayalı kararlar alın.' },
    { icon: Zap, title: 'Tam Otomasyon', description: 'Yinelenen görevleri otopilota bağlayın, ekibinizin zamanını geri kazanın.' },
    { icon: Users, title: 'Senkronize Ekip', description: 'Görev atamaları, yorumlar ve bildirimler ile iletişim kopukluğunu bitirin.' },
    { icon: Package, title: 'Dinamik Stok', description: 'Kritik seviye uyarıları ve otomatik sipariş oluşturma ile stoksuz kalmayın.' },
    { icon: ShieldCheck, title: 'Askeri Güvenlik', description: 'End-to-end şifreleme ve KVKK uyumlu altyapı ile verileriniz güvende.' },
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
    { question: 'RenkFlow ne zaman kullanıma açılacak?', answer: 'RenkFlow şu anda aktif beta sürecinde. Bekleme listesine katılan kullanıcılarımıza öncelikli erişim sağlıyoruz. Genel lansmanımız çok yakında.' },
    { question: 'Hangi sektörlere uygun?', answer: 'Mobilya, tekstil, metal, gıda ve plastik gibi üretim odaklı tüm KOBİ ve kurumsal firmalar için modüler olarak tasarlanmıştır.' },
    { question: 'Mevcut sistemlerimle entegre olabilir mi?', answer: 'Kesinlikle. Modern REST API ve webhook altyapımız sayesinde mevcut ERP, muhasebe ve e-ticaret sistemlerinizle konuşabilir.' },
    { question: 'Verilerim güvende mi?', answer: 'Veri güvenliği önceliğimizdir. 256-bit SSL şifreleme, düzenli yedekleme ve ISO 27001 standartlarında altyapı sunuyoruz.' },
    { question: 'Ücretsiz deneme süreci var mı?', answer: 'Evet, bekleme listesi üyelerimize lansmana özel 3 ay tam sürüm ücretsiz kullanım hakkı tanımlıyoruz.' },
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
    <div className="rf-app-shell min-h-[100svh] relative selection:bg-blue-100 dark:selection:bg-blue-900/40">

      {/* Improved Background - More subtle, "Deep Glass" feel */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] bg-gradient-to-bl from-blue-100/40 dark:from-blue-900/20 to-transparent rounded-full blur-[100px]" />
        <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] bg-gradient-to-tr from-cyan-100/40 dark:from-cyan-900/10 to-transparent rounded-full blur-[100px]" />
      </div>

      <WaitlistNavbar />

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden pt-24 md:pt-28 lg:pt-32 pb-14 lg:pb-16 min-h-[calc(100svh-4.5rem)] flex items-center">
        <div className="rf-page-wrap relative z-10">
          <div className="rf-hero-grid">

            {/* Left Content */}
            <div className="text-center lg:text-left w-full">
               <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 backdrop-blur-sm text-xs font-semibold text-blue-700 dark:text-blue-300 mb-8"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Erken Erişim Başvuruları Açık
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.06] mb-6 text-slate-900 dark:text-white"
              >
                Üretim yönetiminde{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 animate-gradient-x">
                   yeni standart.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 mb-10 lg:max-w-[36rem] leading-relaxed"
              >
                Karmaşık tabloları unutun. RenkFlow ile tüm üretim sürecinizi modern, hızlı ve akıllı bir arayüzden yönetin.
              </motion.p>

              {/* Email Form */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                id="waitlist"
                className="w-full max-w-xl mx-auto lg:mx-0 bg-white/55 dark:bg-slate-900/55 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-none"
              >
                <AnimatePresence mode="wait">
                  {status === 'success' ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 p-3 text-emerald-600 dark:text-emerald-400 font-medium"
                    >
                      <CheckCircle2 size={20} />
                      <p>Listeye eklendiniz! Haberleşeceğiz.</p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit}
                      className="flex flex-col sm:flex-row gap-2"
                    >
                       <div className="relative flex-1">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <Input
                            type="email"
                            placeholder="E-posta adresiniz"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={status === 'loading'}
                            className="h-12 pl-11 pr-4 rounded-lg bg-transparent border-none focus-visible:ring-0 text-slate-900 dark:text-white placeholder:text-slate-400 shadow-none"
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={status === 'loading'}
                          className="h-12 px-6 rounded-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm w-full sm:w-auto"
                        >
                          {status === 'loading' ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span className="mr-2">Yerinizi Ayırtın</span>
                              <ArrowRight size={16} />
                            </>
                          )}
                        </Button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>
             <p className="text-center lg:text-left text-xs text-slate-400 mt-4 px-2">
                * Lansmana özel <span className="text-slate-600 dark:text-slate-300 font-medium">%50 indirim</span> fırsatını kaçırmayın.
              </p>


              {/* Social Proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-8 border-t border-slate-100 dark:border-slate-800/50 pt-8"
              >
                  <div className="flex flex-col gap-1">
                    <div className="flex -space-x-2">
                         {['AY', 'ED', 'MK', 'SK', 'BT'].map((initials, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-[#0B0B0F] flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-sm"
                        >
                          {initials}
                        </div>
                      ))}
                    </div>
                     <span className="text-xs font-medium text-slate-500 dark:text-slate-400 pl-1">
                      500+ ön kayıt
                     </span>
                  </div>

                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-0.5">
                       {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                     <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      4.9/5 Kullanıcı Puanı
                     </span>
                  </div>
              </motion.div>
            </div>

            {/* Right — Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 20, rotateY: -10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.8, delay: 0.2, type: "spring", stiffness: 100 }}
              style={{ perspective: 1000 }}
              className="hidden lg:flex justify-end relative lg:-mr-[3vw] 2xl:-mr-[4vw]"
            >
               <div className="w-[min(62vw,980px)]">
                 <div className="relative rounded-2xl p-2 bg-slate-900/5 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 backdrop-blur-sm shadow-2xl overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    <DashboardPreview isDark={isDark} />
                     {/* Reflection effect */}
                     <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-2xl" />
                 </div>
               </div>

               {/* Decorative floating elements */}
               <motion.div
                 animate={{ y: [0, -10, 0] }}
                 transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                 className="absolute -top-12 -right-8 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 hidden xl:block"
               >
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Haftalık Büyüme</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white text-green-600 dark:text-green-400">+%24.5</div>
                    </div>
                 </div>
               </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="relative py-20 lg:py-28 bg-slate-50/50 dark:bg-slate-900/20">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-6">
              İşletmenizi bir üst seviyeye taşıyın
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
               Karmaşık süreçleri basitleştiren, verimliliği artıran ve ekibinizi güçlendiren araçlar. Hepsi tek bir platformda.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={i * 0.05}
              />
            ))}
          </div>
        </div>
      </section>

       {/* ─── STATS ─── */}
       <section className="py-20 border-y border-slate-200 dark:border-slate-800/60 bg-white dark:bg-[#0B0B0F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                 initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: "spring" }}
              >
                <div className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 mb-2">{stat.value}</div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="relative py-24">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
           <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              3 adımda dijital dönüşüm
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Karmaşık kurulum süreçleri yok. Dakikalar içinde çalışmaya başlayın.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative max-w-5xl mx-auto">
             {/* Connector Line */}
            <div className="hidden md:block absolute top-[2.5rem] left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-blue-200 dark:via-blue-800 to-transparent" />

            {[
              { step: '01', title: 'Hesap Oluştur', description: 'Kurumsal e-postanız ile saniyeler içinde kaydınızı tamamlayın.', icon: Users },
              { step: '02', title: 'Ekibini Davet Et', description: 'Rolleri belirleyin, çalışma arkadaşlarınızı sisteme entegre edin.', icon: Layers },
              { step: '03', title: 'Yönetmeye Başla', description: 'Üretim, stok ve siparişlerinizi tek panelden yönetmenin keyfini çıkarın.', icon: Rocket },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center group"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white dark:bg-slate-800 shadow-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform duration-300">
                   <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 rounded-2xl transform rotate-6 group-hover:rotate-12 transition-transform duration-300" />
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 relative z-10">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="relative py-24 bg-slate-50/50 dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Sektör liderleri güveniyor
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
               Beta programımıza katılan üreticilerin deneyimleri.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((t, i) => (
              <TestimonialCard key={t.name} {...t} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="relative py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
           <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Aklınıza takılabilecekler
            </h2>
             <p className="text-lg text-slate-600 dark:text-slate-400">
               Sık sorulan sorular ve cevapları.
            </p>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {faqs.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFAQ === i}
                onToggle={() => setOpenFAQ(openFAQ === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24">
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative p-10 sm:p-20 rounded-3xl bg-slate-900 dark:bg-blue-950 overflow-hidden text-center shadow-2xl"
          >
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
               <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
               <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
               <div className="inline-flex items-center justify-center p-3 mb-8 bg-white/10 rounded-2xl backdrop-blur-md">
                 <Rocket className="text-white" size={32} />
               </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                Üretimde yeni bir çağ başlıyor.
              </h2>
              <p className="text-lg text-blue-100 mb-10 leading-relaxed">
                Rakiplerinizin önüne geçmek, verimliliğinizi katlamak ve işletmenizi geleceğe taşımak için şimdi harekete geçin.
              </p>

              <Button
                size="lg"
                className="h-14 px-8 rounded-full bg-white text-slate-900 hover:bg-white/90 text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Hemen Başvurun
                <ArrowRight size={20} className="ml-2" />
              </Button>
               <p className="mt-6 text-sm text-blue-200/60">Kredi kartı gerekmez • İptal edilebilir</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-slate-200 dark:border-slate-800 pt-16 pb-8 bg-slate-50 dark:bg-[#0B0B0F]">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="lg:col-span-1">
               <div className="flex items-center gap-2 mb-6">
                 <div className="relative h-6 w-24">
                   <Image
                    src="/renkflow-logo-new.png"
                    alt="RenkFlow"
                    fill
                    className="object-contain object-left"
                   />
                 </div>
               </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                RenkFlow, modern üretim tesisleri için tasarlanmış yeni nesil bir yönetim platformudur.
              </p>
               <div className="flex items-center gap-3">
                {footerSocialLinks.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>

             <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-6">Ürün</h4>
                <ul className="space-y-3">
                   {footerQuickLinks.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} className="text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                        {link.label}
                      </a>
                    </li>
                   ))}
                </ul>
             </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-6">Şirket</h4>
                <ul className="space-y-3">
                   <li><a href="#" className="text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">Hakkımızda</a></li>
                   <li><a href="#" className="text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">Kariyer</a></li>
                   <li><a href="#" className="text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">Blog</a></li>
                </ul>
             </div>

             <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-6">İletişim</h4>
                 <div className="space-y-3">
                   <a href="mailto:info@renkflow.com" className="block text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                    info@renkflow.com
                   </a>
                   <p className="text-sm text-slate-400 dark:text-slate-500">
                    İstanbul, Türkiye
                   </p>
                 </div>
             </div>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} RenkFlow Teknoloji A.Ş. Tüm hakları saklıdır.</p>
            <div className="flex items-center gap-6">
               <a href="#" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Gizlilik Politikası</a>
               <a href="#" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Kullanım Koşulları</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
