import type { Metadata, Viewport } from 'next';

/**
 * SEO Configuration
 * Enterprise-grade SEO metadata and structured data
 */

export const siteConfig = {
  name: 'RenkFlow',
  description: 'Profesyonel işletme yönetimi ve operasyon platformu. Sipariş yönetimi, stok takibi, muhasebe, CRM ve daha fazlası.',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://renkflow.com',
  ogImage: '/og-image.jpg',
  twitterHandle: '@renkflow',
  keywords: [
    'işletme yönetimi',
    'sipariş yönetimi',
    'stok takibi',
    'muhasebe',
    'CRM',
    'tedarikçi yönetimi',
    'üretim planlama',
    'ERP',
    'iş yazılımı',
    'bulut tabanlı yazılım'
  ],
};

export const defaultMetadata: Metadata = {
  title: {
    default: `${siteConfig.name} - Profesyonel İşletme Yönetim Platformu`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: 'RenkFlow Team' }],
  creator: 'RenkFlow',
  publisher: 'RenkFlow',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: `${siteConfig.url}${siteConfig.ogImage}`,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
    images: [`${siteConfig.url}${siteConfig.ogImage}`],
    creator: siteConfig.twitterHandle,
  },
  alternates: {
    canonical: siteConfig.url,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  other: {
    'application-name': siteConfig.name,
    'msapplication-TileColor': '#b87444',
    'msapplication-config': '/browserconfig.xml',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

/**
 * Generate structured data for different page types
 */

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo.png`,
    sameAs: [
      'https://twitter.com/renkflow',
      'https://linkedin.com/company/renkflow',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+90-xxx-xxx-xxxx',
      contactType: 'customer service',
      availableLanguage: ['Turkish', 'English'],
    },
  };
}

export function generateSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'TRY',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
    },
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.url}`,
    })),
  };
}
