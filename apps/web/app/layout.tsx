import { ThemeApplier } from '@/components/layout/ThemeApplier'
import { Analytics } from "@vercel/analytics/react"
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'
import { Toaster } from 'sonner'
import '@/styles/design-system.css'
import './globals.css'
import type { Metadata } from 'next'
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google'
import { ClientComponents } from '@/components/layout/ClientComponents'

const outfit = Outfit({ 
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://renkflow.com';


export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'RenkFlow - Modern Üretim Operasyon Platformu',
    template: '%s | Renkflow',
  },
  description:
    'RenkFlow, üretim hattı takibi, envanter görünürlüğü ve ekip koordinasyonunu tek platformda sunan modern üretim operasyon yazılımıdır.',
  keywords: [
    'üretim yönetimi',
    'fabrika operasyonu',
    'üretim takibi',
    'envanter yönetimi',
    'iş emri takibi',
    'multi-tenant saas',
    'manufacturing software',
    'production tracking',
    'inventory management',
  ],
  authors: [{ name: 'Renkflow' }],
  creator: 'Renkflow A.Ş.',
  publisher: 'Renkflow A.Ş.',
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
    icon: '/logo-r.png',
    shortcut: '/logo-r.png',
    apple: '/logo-r.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: baseUrl,
    siteName: 'Renkflow',
    title: 'RenkFlow - Modern Üretim Operasyon Platformu',
    description:
      'Üretim takibi, envanter yönetimi ve ekip koordinasyonu için tek platform.',
    images: [
      {
        url: '/dashboard-preview.png',
        width: 1200,
        height: 630,
        alt: 'Renkflow Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RenkFlow - Modern Üretim Operasyon Platformu',
    description:
      'Üretim takibi, envanter yönetimi ve ekip koordinasyonu için tek platform.',
    images: ['/dashboard-preview.png'],
    creator: '@renkflow',
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
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* Preconnect to Google Fonts for faster loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols loaded async to prevent render blocking */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#8c5e40" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0B1120" />
        <link rel="canonical" href={baseUrl} />
        
        {/* iOS PWA Configuration */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Renkflow" />
        <link rel="apple-touch-icon" href="/logo-r.png" />
        
        {/* Mobile Viewport */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Microsoft Tile */}
        <meta name="msapplication-TileColor" content="#8c5e40" />
        <meta name="msapplication-TileImage" content="/logo-r.png" />
      </head>
      <body className={`${outfit.variable} ${jakarta.variable} font-sans antialiased`}>
        <Providers>
          <ErrorBoundary>
            <SyncStatusBar />
            <ThemeApplier />
            {children}
            <Toaster position="top-center" richColors />
            <ClientComponents />
          </ErrorBoundary>
        </Providers>
        <Analytics />
        <GoogleAnalytics GA_MEASUREMENT_ID={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ''} />
      </body>
    </html>
  )
}
