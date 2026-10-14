import { ThemeApplier } from '@/components/layout/ThemeApplier'
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'
import { Toaster } from 'sonner'
import '@/styles/design-system.css'
import './globals.css'
import '@/styles/workspace.css'
import '@/styles/theme.css'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClientComponents } from '@/components/layout/ClientComponents'

const geist = Geist({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-mono',
  display: 'swap',
})

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://renkflow.com';


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfb' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0f' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'RenkFlow · Pergola ve cam sistemleri için operasyon platformu',
    template: '%s | RenkFlow',
  },
  description:
    'Pergola, giyotin cam, tente ve alüminyum tavan projelerinde keşiften montaja teklif, kesim planı, depo ve tahsilatı aynı veride toplayan operasyon platformu.',
  keywords: [
    'üretim yönetimi',
    'fabrika operasyonu',
    'üretim takibi',
    'envanter yönetimi',
    'iş emri takibi',
    'pergola üretim yazılımı',
    'giyotin cam',
    'profil kesim planı',
    'alüminyum stok takibi',
  ],
  authors: [{ name: 'RenkFlow' }],
  creator: 'Renk Alüminyum',
  publisher: 'Renk Alüminyum',
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
  icons: {
    icon: [{url:'/brand/favicon.svg',type:'image/svg+xml'},{url:'/favicon.ico',sizes:'any'}],
    shortcut: '/favicon.ico',
    apple: '/brand/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: baseUrl,
    siteName: 'RenkFlow',
    title: 'RenkFlow · Pergola ve cam sistemleri için operasyon platformu',
    description:
      'Ölçüye özel her proje için teklif, kesim planı, depo ve tahsilat tek yerde.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RenkFlow · Pergola ve cam sistemleri için operasyon platformu',
    description:
      'Ölçüye özel her proje için teklif, kesim planı, depo ve tahsilat tek yerde.',
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ? {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  } : undefined,
  category: 'technology',
}

import { Providers } from '@/lib/context/Providers'
import { SyncStatusBar } from '@/components/sync/SyncStatusBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        
        {/* iOS PWA Configuration */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="RenkFlow" />
        <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
        
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Microsoft Tile */}
        <meta name="msapplication-TileColor" content="#111113" />
        <meta name="msapplication-TileImage" content="/brand/icon-192.png" />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers>
          <ErrorBoundary>
            <SyncStatusBar />
            <ThemeApplier />
            {children}
            <Toaster position="top-center" richColors />
            <ClientComponents />
          </ErrorBoundary>
        </Providers>
        <GoogleAnalytics GA_MEASUREMENT_ID={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''} />
      </body>
    </html>
  )
}
