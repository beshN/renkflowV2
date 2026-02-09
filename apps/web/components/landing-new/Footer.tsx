'use client';

import React, { memo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Twitter, Instagram, Linkedin, Mail, MapPin, Phone, LucideIcon, Github, ArrowUpRight, Heart, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const footerLinks = {
  product: [
    { label: 'Özellikler', href: '/features' },
    { label: 'Fiyatlandırma', href: '/pricing' },
    { label: 'Entegrasyonlar', href: '/integrations' },
    { label: 'SSS', href: '/faq' },
    { label: 'Yol Haritası', href: '/roadmap', badge: 'Yeni' },
  ],
  company: [
    { label: 'Hakkımızda', href: '/about' },
    { label: 'İletişim', href: '/contact' },
    { label: 'Kariyer', href: '/careers', badge: 'İşe Alıyoruz' },
    { label: 'Blog', href: '/blog' },
    { label: 'Basın Kiti', href: '/press' },
  ],
  resources: [
    { label: 'Dokümantasyon', href: '/docs' },
    { label: 'Değişiklik Günlüğü', href: '/changelog' },
    { label: 'Durum Sayfası', href: '/status' },
    { label: 'Güvenlik', href: '/security' },
  ],
};

export const Footer: React.FC = memo(() => {
  const currentYear = new Date().getFullYear();
  const [nlEmail, setNlEmail] = useState('');
  const [nlStatus, setNlStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [nlMessage, setNlMessage] = useState('');

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nlEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNlStatus('error');
      setNlMessage('Geçerli bir e-posta adresi giriniz.');
      return;
    }
    setNlStatus('loading');
    setNlMessage('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNlStatus('error');
        setNlMessage(data.error || 'Bir hata oluştu. Lütfen tekrar deneyin.');
      } else {
        setNlStatus('success');
        setNlMessage(data.message || 'Başarıyla abone oldunuz!');
        setNlEmail('');
      }
    } catch {
      setNlStatus('error');
      setNlMessage('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  };

  return (
    <footer className="relative w-full overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" />
      
      {/* Decorative Elements */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.06),transparent_50%),radial-gradient(circle_at_80%_100%,rgba(16,185,129,0.06),transparent_50%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-px w-[90%] -translate-x-1/2 bg-gradient-to-r from-transparent via-slate-300/50 dark:via-slate-700/50 to-transparent"
      />

      <div className="relative w-full px-4 sm:px-6 lg:px-12 xl:px-16">
        {/* Newsletter Section */}
        <div className="py-12 lg:py-16 border-b border-slate-200/70 dark:border-slate-800/70">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Güncel Kalın
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Yeni özellikler, güncellemeler ve ipuçları için bültenimize abone olun.
              </p>
            </div>
            {nlStatus === 'success' ? (
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={18} />
                {nlMessage}
              </div>
            ) : (
              <div className="w-full lg:w-auto">
                <form className="flex gap-3" onSubmit={handleNewsletterSubmit}>
                  <input
                    type="email"
                    value={nlEmail}
                    onChange={(e) => { setNlEmail(e.target.value); if (nlStatus === 'error') setNlStatus('idle'); }}
                    placeholder="E-posta adresiniz"
                    disabled={nlStatus === 'loading'}
                    className={cn(
                      'flex-1 lg:w-72 h-12 px-4 rounded-xl text-sm',
                      'bg-white dark:bg-slate-900',
                      'border border-slate-200 dark:border-slate-700',
                      'placeholder:text-slate-400',
                      'focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500',
                      'transition-all duration-200',
                      'disabled:opacity-50',
                      nlStatus === 'error' && 'border-red-400 dark:border-red-600'
                    )}
                  />
                  <motion.button
                    type="submit"
                    disabled={nlStatus === 'loading'}
                    className={cn(
                      'px-6 h-12 rounded-xl text-sm font-semibold',
                      'bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white',
                      'shadow-[0_4px_20px_-4px_rgba(14,165,233,0.4)]',
                      'hover:shadow-[0_8px_30px_-4px_rgba(14,165,233,0.5)]',
                      'transition-shadow duration-300',
                      'disabled:opacity-70 disabled:cursor-not-allowed'
                    )}
                    whileHover={nlStatus !== 'loading' ? { scale: 1.02 } : undefined}
                    whileTap={nlStatus !== 'loading' ? { scale: 0.98 } : undefined}
                  >
                    {nlStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 'Abone Ol'}
                  </motion.button>
                </form>
                {nlStatus === 'error' && nlMessage && (
                  <p className="mt-2 text-xs text-red-500 dark:text-red-400">{nlMessage}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="py-12 lg:py-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2 space-y-6">
            <Link href="/" className="inline-block group">
              <div className="relative h-12 w-40">
                <Image 
                  src="/renkflow-logo-new.png" 
                  alt="RenkFlow" 
                  fill
                  sizes="160px"
                  className="object-contain object-left opacity-90 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              İş süreçlerinizi modernize eden, ekibinizin verimliliğini artıran yeni nesil üretim yönetimi platformu.
            </p>
            <div className="flex gap-2">
              <SocialIcon icon={Twitter} href="https://twitter.com/renkflow" label="Twitter" />
              <SocialIcon icon={Linkedin} href="https://linkedin.com/company/renkflow" label="LinkedIn" />
              <SocialIcon icon={Instagram} href="https://instagram.com/renkflow" label="Instagram" />
              <SocialIcon icon={Github} href="https://github.com/renkflow" label="GitHub" />
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">
              Ürün
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <FooterLink {...link} />
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">
              Kurumsal
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <FooterLink {...link} />
                </li>
              ))}
            </ul>
          </div>

          {/* Resources & Contact */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">
              Kaynaklar
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <FooterLink {...link} />
                </li>
              ))}
            </ul>
            
            {/* Contact Info */}
            <div className="mt-8 space-y-3">
              <a 
                href="mailto:info@renkflow.com" 
                className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              >
                <Mail size={14} />
                info@renkflow.com
              </a>
              <div className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                <span>Güngören, İstanbul</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-slate-200/70 dark:border-slate-800/70">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400 flex items-center gap-1">
              &copy; {currentYear} RenkFlow. Türkiye'de <Heart size={12} className="text-red-500 fill-red-500" /> ile yapıldı.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-400">
              <Link href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Gizlilik
              </Link>
              <Link href="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Kullanım Koşulları
              </Link>
              <Link href="/cookies" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Çerez Politikası
              </Link>
              <Link href="/sitemap.xml" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                Site Haritası
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

// Footer Link Component
interface FooterLinkProps {
  label: string;
  href: string;
  badge?: string;
  external?: boolean;
}

const FooterLink = ({ label, href, badge, external }: FooterLinkProps) => (
  <Link
    href={href}
    target={external ? '_blank' : undefined}
    rel={external ? 'noopener noreferrer' : undefined}
    className="group inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
  >
    {label}
    {external && <ArrowUpRight size={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />}
    {badge && (
      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gradient-to-r from-sky-500/10 to-emerald-500/10 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/20">
        {badge}
      </span>
    )}
  </Link>
);

// Social Icon Component
const SocialIcon = ({ icon: Icon, href, label }: { icon: LucideIcon; href: string; label: string }) => (
  <motion.a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className={cn(
      'w-10 h-10 rounded-xl flex items-center justify-center',
      'bg-white dark:bg-slate-900',
      'border border-slate-200/80 dark:border-slate-800',
      'text-slate-500 dark:text-slate-400',
      'hover:text-white hover:border-transparent',
      'hover:bg-gradient-to-br hover:from-sky-600 hover:via-blue-600 hover:to-emerald-500',
      'shadow-sm hover:shadow-lg hover:shadow-sky-500/20',
      'transition-all duration-300'
    )}
    whileHover={{ scale: 1.05, y: -2 }}
    whileTap={{ scale: 0.95 }}
  >
    <Icon size={18} />
  </motion.a>
);
