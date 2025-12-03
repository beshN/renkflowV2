import { ThemeApplier } from '@/components/layout/ThemeApplier'
import { Analytics } from "@vercel/analytics/react"
import { Toaster } from 'sonner'
import './globals.css'
import type { Metadata } from 'next'
import { Sora } from 'next/font/google'
import { Providers } from '@/lib/context/Providers'

const sora = Sora({ 
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Renkflow - İş Akışınızı Dönüştürün',
  description: 'Modern iş akışı yönetim platformu',
  icons: {
    icon: '/logo-r.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={`${sora.variable} font-display antialiased`}>
        <Providers>
          <ThemeApplier />
          {children}
          <Toaster position="top-center" richColors />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
