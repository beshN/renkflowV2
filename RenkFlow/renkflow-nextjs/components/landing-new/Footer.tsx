'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Twitter, Instagram, Linkedin, Mail, MapPin, Phone, LucideIcon } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-50/80 dark:bg-slate-950 border-t border-slate-200/70 dark:border-slate-800 pt-16 pb-8 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.08),transparent_45%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.08),transparent_40%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-px w-[80%] -translate-x-1/2 bg-gradient-to-r from-transparent via-sky-400/40 to-transparent"
      />
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand Column */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative h-16 w-48">
                 <Image 
                    src="/logo-full.png" 
                    alt="RenkFlow" 
                    fill
                    sizes="192px"
                    className="object-contain object-left opacity-80 group-hover:opacity-100 transition-opacity"
                 />
              </div>
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
              Üretim yönetimini basitleştiren, verimliliği artıran yeni nesil SaaS platformu.
            </p>
            <div className="flex gap-4 pt-2">
              <SocialIcon icon={Twitter} href="https://twitter.com/renkflow" />
              <SocialIcon icon={Linkedin} href="https://linkedin.com/company/renkflow" />
              <SocialIcon icon={Instagram} href="https://instagram.com/renkflow" />
            </div>
          </div>

          {/* Links Column 1 */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Ürün</h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><Link href="/features" className="hover:text-sky-600 transition-colors">Özellikler</Link></li>
              <li><Link href="/pricing" className="hover:text-sky-600 transition-colors">Fiyatlandırma</Link></li>
              <li><Link href="/integrations" className="hover:text-sky-600 transition-colors">Entegrasyonlar</Link></li>
              <li><Link href="/faq" className="hover:text-sky-600 transition-colors">SSS</Link></li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Şirket</h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><Link href="/about" className="hover:text-emerald-500 transition-colors">Hakkımızda</Link></li>
              <li><Link href="/contact" className="hover:text-emerald-500 transition-colors">İletişim</Link></li>
              <li><Link href="/careers" className="hover:text-emerald-500 transition-colors">Kariyer</Link></li>
              <li><Link href="/blog" className="hover:text-emerald-500 transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Contact Column */}
          <div>
             <h4 className="font-semibold text-slate-900 dark:text-white mb-4">İletişim</h4>
             <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                <li className="flex items-start gap-2">
                    <MapPin size={16} className="mt-0.5 text-sky-600" />
                    <span>Teknopark İstanbul, 34912<br/>Pendik/İstanbul</span>
                </li>
                <li className="flex items-center gap-2">
                    <Mail size={16} className="text-sky-600" />
                    <a href="mailto:info@renkflow.com" className="hover:text-sky-600">info@renkflow.com</a>
                </li>
                <li className="flex items-center gap-2">
                    <Phone size={16} className="text-emerald-500" />
                    <a href="tel:+902120000000" className="hover:text-emerald-500">+90 (212) 000 00 00</a>
                </li>
             </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200/70 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400">
                &copy; {new Date().getFullYear()} RenkFlow. Tüm hakları saklıdır.
            </p>
            <div className="flex gap-6 text-xs text-slate-400">
                <Link href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-200">Gizlilik Politikası</Link>
                <Link href="/terms" className="hover:text-slate-600 dark:hover:text-slate-200">Kullanım Koşulları</Link>
            </div>
        </div>
      </div>
    </footer>
  );
};

const SocialIcon = ({ icon: Icon, href }: { icon: LucideIcon, href: string }) => (
    <a
      href={href}
      className="w-9 h-9 rounded-full bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-white hover:border-transparent hover:bg-gradient-to-br hover:from-sky-600 hover:via-blue-600 hover:to-emerald-500 transition-all shadow-sm"
    >
        <Icon size={16} />
    </a>
);
