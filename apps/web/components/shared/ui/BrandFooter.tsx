'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
  Twitter, 
  Instagram, 
  Linkedin, 
  Github, 
  Facebook,
  Youtube,
  Mail,
  Phone,
  MapPin,
  Heart,
  ExternalLink,
} from 'lucide-react';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

interface SocialLink {
  platform: 'twitter' | 'instagram' | 'linkedin' | 'github' | 'facebook' | 'youtube';
  href: string;
}

interface BrandFooterProps {
  logo?: ReactNode;
  brandName?: string;
  description?: string;
  sections?: FooterSection[];
  socialLinks?: SocialLink[];
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  bottomLinks?: FooterLink[];
  showLocalEmphasis?: boolean;
  localEmphasisText?: string;
  className?: string;
  variant?: 'default' | 'dark' | 'glass' | 'gradient';
}

const socialIcons = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  github: Github,
  facebook: Facebook,
  youtube: Youtube,
};

export function BrandFooter({
  logo,
  brandName = 'RenkFlow',
  description = 'Tekstil sektörü için geliştirilmiş profesyonel sipariş ve üretim yönetim sistemi.',
  sections = [],
  socialLinks = [],
  contactInfo,
  bottomLinks = [],
  showLocalEmphasis = true,
  localEmphasisText = "Türkiye'de ❤️ ile yapıldı",
  className,
  variant = 'default',
}: BrandFooterProps) {
  const currentYear = new Date().getFullYear();

  const variantStyles = {
    default: 'bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800',
    dark: 'bg-gray-900 text-white',
    glass: 'bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-t border-white/20 dark:border-gray-700/20',
    gradient: 'bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900',
  };

  const textStyles = {
    default: 'text-gray-600 dark:text-gray-400',
    dark: 'text-gray-400',
    glass: 'text-gray-600 dark:text-gray-400',
    gradient: 'text-gray-600 dark:text-gray-400',
  };

  const headingStyles = {
    default: 'text-gray-900 dark:text-white',
    dark: 'text-white',
    glass: 'text-gray-900 dark:text-white',
    gradient: 'text-gray-900 dark:text-white',
  };

  return (
    <footer className={cn(variantStyles[variant], className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-4">
              {logo || (
                <div className="relative w-8 h-8 flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full" />
                  <div 
                    className="absolute inset-1 bg-gradient-to-br from-green-400 to-green-600 rounded-full opacity-60" 
                    style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} 
                  />
                </div>
              )}
              <span className={cn('font-semibold text-lg', headingStyles[variant])}>
                {brandName}
              </span>
            </div>

            {/* Description */}
            <p className={cn('text-sm mb-6 leading-relaxed', textStyles[variant])}>
              {description}
            </p>

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="flex items-center gap-3">
                {socialLinks.map((link) => {
                  const Icon = socialIcons[link.platform];
                  return (
                    <a
                      key={link.platform}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        textStyles[variant],
                        'hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30'
                      )}
                      aria-label={link.platform}
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Link Sections */}
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className={cn('font-semibold text-sm mb-4', headingStyles[variant])}>
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'text-sm inline-flex items-center gap-1 transition-colors hover:text-orange-500',
                          textStyles[variant]
                        )}
                      >
                        {link.label}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className={cn(
                          'text-sm transition-colors hover:text-orange-500',
                          textStyles[variant]
                        )}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact Info */}
          {contactInfo && (
            <div>
              <h3 className={cn('font-semibold text-sm mb-4', headingStyles[variant])}>
                İletişim
              </h3>
              <ul className="space-y-3">
                {contactInfo.email && (
                  <li>
                    <a
                      href={`mailto:${contactInfo.email}`}
                      className={cn(
                        'text-sm inline-flex items-center gap-2 transition-colors hover:text-orange-500',
                        textStyles[variant]
                      )}
                    >
                      <Mail className="w-4 h-4" />
                      {contactInfo.email}
                    </a>
                  </li>
                )}
                {contactInfo.phone && (
                  <li>
                    <a
                      href={`tel:${contactInfo.phone}`}
                      className={cn(
                        'text-sm inline-flex items-center gap-2 transition-colors hover:text-orange-500',
                        textStyles[variant]
                      )}
                    >
                      <Phone className="w-4 h-4" />
                      {contactInfo.phone}
                    </a>
                  </li>
                )}
                {contactInfo.address && (
                  <li className={cn('text-sm flex items-start gap-2', textStyles[variant])}>
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{contactInfo.address}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Copyright & Local Emphasis */}
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              <p className={cn('text-sm', textStyles[variant])}>
                © {currentYear} {brandName}. Tüm hakları saklıdır.
              </p>
              {showLocalEmphasis && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-sm',
                  textStyles[variant]
                )}>
                  <span className="hidden sm:inline">•</span>
                  {localEmphasisText}
                </span>
              )}
            </div>

            {/* Bottom Links */}
            {bottomLinks.length > 0 && (
              <div className="flex items-center gap-4">
                {bottomLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={cn(
                      'text-sm transition-colors hover:text-orange-500',
                      textStyles[variant]
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

interface SimpleFooterProps {
  brandName?: string;
  showLocalEmphasis?: boolean;
  className?: string;
}

export function SimpleFooter({
  brandName = 'RenkFlow',
  showLocalEmphasis = true,
  className,
}: SimpleFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn('py-6 px-4 text-center', className)}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>© {currentYear} {brandName}</span>
        {showLocalEmphasis && (
          <>
            <span className="hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1">
              Türkiye'de <Heart className="w-3 h-3 text-red-500 fill-red-500" /> ile yapıldı
            </span>
          </>
        )}
      </div>
    </footer>
  );
}
