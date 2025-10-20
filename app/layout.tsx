import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"
import { Footer } from "@/components/footer"
import { OrdersProvider } from "@/lib/orders-context"
import { ToastProvider } from "@/lib/toast-provider"
import { ErrorBoundary } from "@/components/error-boundary"

import { Geist as V0_Font_Geist, Source_Serif_4 as V0_Font_Source_Serif_4 } from "next/font/google"

// Initialize fonts
const _geist = V0_Font_Geist({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
})
const _geistMono = GeistMono // Corrected variable name
const _sourceSerif_4 = V0_Font_Source_Serif_4({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
})

export const metadata: Metadata = {
  title: "RenkFlow - Renk Sipariş Takip",
  description:
    "Üretim işletmeleri için profesyonel sipariş takip sistemi. Siparişlerinizi kolayca yönetin, durumlarını takip edin ve müşterilerinize hızlı hizmet verin.",
  keywords: "sipariş takip, üretim yönetimi, alüminyum, cam, demir, tente, kumaş, renk alüminyum",
  authors: [{ name: "Renk Alüminyum" }],
  generator: "v0.app",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "RenkFlow - Renk Sipariş Takip",
    description: "Üretim işletmeleri için profesyonel sipariş takip sistemi",
    type: "website",
    locale: "tr_TR",
    siteName: "RenkFlow",
    images: [{ url: "/icon.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RenkFlow - Renk Sipariş Takip",
    description: "Üretim işletmeleri için profesyonel sipariş takip sistemi",
    images: ["/icon.png"],
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans flex flex-col min-h-screen antialiased`}>
        <ErrorBoundary>
          <OrdersProvider>
            <Suspense fallback={null}>{children}</Suspense>
            <Footer />
            <ToastProvider />
          </OrdersProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
