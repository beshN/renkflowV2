import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/lib/context/Providers';
import { Toaster } from 'sonner';
import { ServiceWorkerUnregister } from '@/components/ServiceWorkerUnregister';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RenkFlow',
  description: 'Renkli Mobilya Sipariş Takip Sistemi',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={inter.className}>
        <Providers>
          <ServiceWorkerUnregister />
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
