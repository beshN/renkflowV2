

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize package imports for better performance
  experimental: {
    optimizePackageImports: ['@dnd-kit/core', '@dnd-kit/sortable', 'framer-motion', 'lucide-react'],
    // Enable experimental optimizations
    optimizeCss: true,
  },
  
  output: 'standalone',
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-*.r2.dev', // Allow all R2 buckets
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'renkflowv2-storage.e133c6a8581c4228807833059082381e.r2.cloudflarestorage.com',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;

