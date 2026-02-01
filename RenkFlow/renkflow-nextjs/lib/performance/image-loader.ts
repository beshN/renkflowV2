export interface ImageLoaderOptions {
  src: string;
  width: number;
  quality?: number;
}

export interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  className?: string;
}

export function imageLoader({ src, width, quality = 75 }: ImageLoaderOptions): string {
  if (src.startsWith('https://')) {
    const url = new URL(src);
    if (url.hostname.includes('cloudinary')) {
      return src.replace('/upload/', `/upload/f_auto,q_${quality},w_${width}/`);
    }
    if (url.hostname.includes('imgix')) {
      url.searchParams.set('auto', 'format');
      url.searchParams.set('q', quality.toString());
      url.searchParams.set('w', width.toString());
      return url.toString();
    }
    return src;
  }
  return src;
}

export function generateSrcSet(src: string, widths: number[] = [640, 750, 828, 1080, 1200, 1920]): string {
  return widths.map((width) => `${imageLoader({ src, width, quality: 75 })} ${width}w`).join(', ');
}

export async function generateBlurPlaceholder(src: string): Promise<string | undefined> {
  try {
    const { getPlaiceholder } = await import('plaiceholder');
    const buffer = await fetch(src).then(async (res) => Buffer.from(await res.arrayBuffer()));
    const { base64 } = await getPlaiceholder(buffer);
    return base64;
  } catch (e) {
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNjY2MiLz48L3N2Zz4=';
  }
}

export function calculateSizes(breakpoints: { [key: string]: string } = { default: '100vw', sm: '100vw', md: '50vw', lg: '33vw', xl: '25vw' }): string {
  const entries = Object.entries(breakpoints);
  const defaultSize = entries.find(([key]) => key === 'default')?.[1] || '100vw';
  const mediaQueries = entries
    .filter(([key]) => key !== 'default')
    .map(([breakpoint, size]) => {
      const minWidth = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 }[breakpoint];
      return minWidth ? `(min-width: ${minWidth}px) ${size}` : null;
    })
    .filter(Boolean);
  return [...mediaQueries, defaultSize].join(', ');
}

export function preloadCriticalImage(src: string): void {
  if (typeof window === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  (link as any).fetchPriority = 'high';
  document.head.appendChild(link);
}

export function lazyLoadImage(img: HTMLImageElement, src: string, options?: IntersectionObserverInit): () => void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        img.src = src;
        observer.disconnect();
      }
    });
  }, { rootMargin: '50px', threshold: 0.01, ...options });
  observer.observe(img);
  return () => observer.disconnect();
}

export function getOptimalImageFormat(): 'avif' | 'webp' | 'jpeg' {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'jpeg';
  if (canvas.toDataURL('image/avif').includes('data:image/avif')) return 'avif';
  if (canvas.toDataURL('image/webp').includes('data:image/webp')) return 'webp';
  return 'jpeg';
}

export default imageLoader;
