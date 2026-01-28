'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Twitter, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react';

export const WaitlistFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pt-16 pb-8">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center mb-12">
          
          {/* Brand Column - Centered */}
          <div className="space-y-4 flex flex-col items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="relative h-32 w-112 sm:h-40 sm:w-144">
                 <Image 
                    src="/logo-full.png" 
                    alt="RenkFlow" 
                    fill
                    className="object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                 />
              </div>
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
              Üretim yönetimini basitleştiren, verimliliği artıran yeni nesil SaaS platformu.
            </p>
            <div className="flex gap-4 pt-2 justify-center">
              <SocialIcon icon={Twitter} href="#" />
              <SocialIcon icon={Linkedin} href="#" />
              <SocialIcon icon={Instagram} href="#" />
            </div>
          </div>

        </div>

        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400">
                © {currentYear} RenkFlow Yazılım A.Ş. Tüm hakları saklıdır.
            </p>
            <div className="flex gap-6 text-xs text-slate-400">
                <Link href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-200">Gizlilik Politikası</Link>
                <Link href="/terms" className="hover:text-slate-600 dark:hover:text-slate-200">Kullanım Koşulları</Link>
                <Link href="/cookies" className="hover:text-slate-600 dark:hover:text-slate-200">Çerez Politikası</Link>
            </div>
        </div>
      </div>
    </footer>
  );
};

const SocialIcon = ({ icon: Icon, href }: { icon: any, href: string }) => (
    <a href={href} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-blue-600 hover:text-white transition-all">
        <Icon size={16} />
    </a>
);
