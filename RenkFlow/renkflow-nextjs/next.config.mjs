/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize package imports for better performance
  experimental: {
    optimizePackageImports: [
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      'framer-motion',
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-tabs',
      '@radix-ui/react-scroll-area',
      'date-fns',
      'recharts',
      'sonner',
      'zustand',
      'react-hook-form',
      '@hookform/resolvers',
    ],
    optimizeCss: true,
  },

  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  async generateBuildId() {
    return process.env.NEXT_BUILD_ID || 'renkflow-build';
  },

  // Increase static page generation timeout for complex pages
  staticPageGenerationTimeout: 300,

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  output: 'standalone',

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: 'cdn.renkflow.com',
      },
      {
        protocol: 'https',
        hostname: 'pub-*.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'renkflowv2-storage.e133c6a8581c4228807833059082381e.r2.cloudflarestorage.com',
        pathname: '/**',
      },
    ],
  },

  // Headers for caching and performance
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:all*(js|css)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:all*(woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Permitted-Cross-Domain-Policies',
            value: 'none',
          },
        ],
      },
    ];
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Optimize chunk splitting
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Vendor chunk for large libraries
          vendor: {
            test: /[\\/]node_modules[\\/](framer-motion|recharts|date-fns)[\\/]/,
            name: 'vendor-large',
            chunks: 'all',
            priority: 20,
          },
          // UI components chunk
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|@dnd-kit)[\\/]/,
            name: 'vendor-ui',
            chunks: 'all',
            priority: 15,
          },
        },
      };
    }
    config.optimization.moduleIds = 'deterministic';
    config.optimization.chunkIds = 'deterministic';
    return config;
  },

  turbopack: {},
};

export default nextConfig;
