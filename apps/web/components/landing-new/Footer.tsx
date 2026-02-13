'use client';

import { memo, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin, Linkedin } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/client';

const labels = {
  tr: {
    description:
      'RenkFlow, üretim operasyonları için sipariş, envanter ve ekip koordinasyonunu tek platformda birleştiren SaaS üründür.',
    product: 'Ürün',
    company: 'Şirket',
    legal: 'Yasal',
    features: 'Özellikler',
    pricing: 'Fiyatlandırma',
    docs: 'Dokümantasyon',
    about: 'Hakkımızda',
    blog: 'Blog',
    contact: 'İletişim',
    privacy: 'Gizlilik',
    terms: 'Kullanım Koşulları',
    cookies: 'Çerez Politikası',
    rights: 'Tüm hakları saklıdır.',
    location: 'Istanbul, Turkiye',
  },
  en: {
    description:
      'RenkFlow is a manufacturing SaaS that combines production tracking, inventory visibility, and team coordination in one platform.',
    product: 'Product',
    company: 'Company',
    legal: 'Legal',
    features: 'Features',
    pricing: 'Pricing',
    docs: 'Documentation',
    about: 'About',
    blog: 'Blog',
    contact: 'Contact',
    privacy: 'Privacy',
    terms: 'Terms',
    cookies: 'Cookie Policy',
    rights: 'All rights reserved.',
    location: 'Istanbul, Turkiye',
  },
  ar: {
    description:
      'RenkFlow منصة SaaS للتصنيع توحّد تتبع الإنتاج ورؤية المخزون وتنسيق الفرق في منصة واحدة.',
    product: 'المنتج',
    company: 'الشركة',
    legal: 'قانوني',
    features: 'الميزات',
    pricing: 'الأسعار',
    docs: 'التوثيق',
    about: 'من نحن',
    blog: 'المدونة',
    contact: 'تواصل',
    privacy: 'الخصوصية',
    terms: 'الشروط',
    cookies: 'سياسة ملفات الارتباط',
    rights: 'جميع الحقوق محفوظة.',
    location: 'Istanbul, Turkiye',
  },
} as const;

export const Footer: React.FC = memo(() => {
  const { locale, isRtl } = useTranslation();
  const text = useMemo(() => labels[(locale as keyof typeof labels) || 'tr'] ?? labels.tr, [locale]);
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200/80 bg-white/85 py-12 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="rf-page-wrap">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr]">
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <Link href="/" className="inline-block">
              <Image
                src="/email-assets/header-logo.png"
                alt="RenkFlow"
                width={442}
                height={88}
                className="h-9 w-auto object-contain"
              />
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {text.description}
            </p>
            <div className={`mt-4 flex gap-3 ${isRtl ? 'justify-end' : 'justify-start'}`}>
              <a
                href="mailto:info@renkflow.com"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                <Mail className="h-4 w-4" />
                info@renkflow.com
              </a>
              <a
                href="https://www.linkedin.com/company/renkflow"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 dark:text-slate-100">{text.product}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li><Link href="/features" className="hover:text-slate-900 dark:hover:text-white">{text.features}</Link></li>
              <li><Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">{text.pricing}</Link></li>
              <li><Link href="/docs" className="hover:text-slate-900 dark:hover:text-white">{text.docs}</Link></li>
            </ul>
          </div>

          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 dark:text-slate-100">{text.company}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li><Link href="/about" className="hover:text-slate-900 dark:hover:text-white">{text.about}</Link></li>
              <li><Link href="/blog" className="hover:text-slate-900 dark:hover:text-white">{text.blog}</Link></li>
              <li><Link href="/contact" className="hover:text-slate-900 dark:hover:text-white">{text.contact}</Link></li>
            </ul>
          </div>

          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 dark:text-slate-100">{text.legal}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li><Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">{text.privacy}</Link></li>
              <li><Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">{text.terms}</Link></li>
              <li><Link href="/cookies" className="hover:text-slate-900 dark:hover:text-white">{text.cookies}</Link></li>
            </ul>
            <p className={`mt-4 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 ${isRtl ? 'justify-end' : ''}`}>
              <MapPin className="h-4 w-4" />
              {text.location}
            </p>
          </div>
        </div>

        <div className={`mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 ${isRtl ? 'text-right' : 'text-left'}`}>
          © {currentYear} RenkFlow. {text.rights}
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';
