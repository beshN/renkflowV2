/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@dnd-kit/core', '@dnd-kit/sortable'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        pathname: '/api/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-*.r2.dev', // Allow all R2 buckets
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'renkflow-documents.e133c6a8581c4228807833059082381e.r2.cloudflarestorage.com',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
