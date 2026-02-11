/**
 * PWA Configuration
 * Progressive Web App features for offline support and native-like experience
 */

interface RuntimeCache {
  urlPattern: RegExp | string;
  handler: string;
  options: {
    cacheName: string;
    expiration: {
      maxEntries: number;
      maxAgeSeconds: number;
    };
  };
}

interface PWAConfig {
  dest: string;
  register: boolean;
  skipWaiting: boolean;
  disable: boolean;
  runtimeCaching: RuntimeCache[];
  buildExcludes: RegExp[];
  fallbacks: {
    document: string;
    image: string;
  };
}

export const pwaConfig: PWAConfig = {
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https?.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
      },
    },
  ],
  buildExcludes: [/middleware-manifest\.json$/],
  fallbacks: {
    document: '/offline',
    image: '/fallback-image.png',
  },
};

/**
 * Web App Manifest
 */
export const manifest = {
  name: 'RenkFlow',
  short_name: 'RenkFlow',
  description: 'Profesyonel işletme yönetimi platformu',
  start_url: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#b87444',
  orientation: 'portrait-primary',
  scope: '/',
  icons: [
    {
      src: '/icon-72x72.png',
      sizes: '72x72',
      type: 'image/png',
      purpose: 'maskable any',
    },
    {
      src: '/icon-96x96.png',
      sizes: '96x96',
      type: 'image/png',
      purpose: 'maskable any',
    },
    {
      src: '/icon-128x128.png',
      sizes: '128x128',
      type: 'image/png',
      purpose: 'maskable any',
    },
    {
      src: '/icon-144x144.png',
      sizes: '144x144',
      type: 'image/png',
      purpose: 'maskable any',
    },
    {
      src: '/icon-152x152.png',
      sizes: '152x152',
      type: 'image/png',
      purpose: 'maskable any',
    },
    {
      src: '/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable any',
    },
    {
      src: '/icon-384x384.png',
      sizes: '384x384',
      type: 'image/png',
      purpose: 'maskable any',
    },
    {
      src: '/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable any',
    },
  ],
  categories: ['business', 'productivity'],
  lang: 'tr',
  dir: 'ltr',
  shortcuts: [
    {
      name: 'Yeni Sipariş',
      short_name: 'Sipariş',
      description: 'Yeni sipariş oluştur',
      url: '/new-order',
      icons: [{ src: '/shortcut-order.png', sizes: '96x96' }],
    },
    {
      name: 'Siparişler',
      short_name: 'Siparişler',
      description: 'Tüm siparişleri görüntüle',
      url: '/orders',
      icons: [{ src: '/shortcut-orders.png', sizes: '96x96' }],
    },
    {
      name: 'Finans',
      short_name: 'Finans',
      description: 'Finansal durumu görüntüle',
      url: '/finance',
      icons: [{ src: '/shortcut-finance.png', sizes: '96x96' }],
    },
  ],
};
