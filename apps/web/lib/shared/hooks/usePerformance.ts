'use client';

import { useEffect, useState, useCallback, useRef, RefObject } from 'react';

interface UseOptimizedInViewOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Optimized Intersection Observer hook for better performance
 * Uses a single shared observer instance across components
 */
const observerCallbacks = new Map<Element, (isIntersecting: boolean) => void>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const callback = observerCallbacks.get(entry.target);
          if (callback) {
            callback(entry.isIntersecting);
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );
  }
  return sharedObserver;
}

export function useOptimizedInView<T extends HTMLElement = HTMLDivElement>(
  options: UseOptimizedInViewOptions = {}
): [RefObject<T>, boolean] {
  const { threshold = 0.1, rootMargin = '50px', triggerOnce = true } = options;
  const ref = useRef<T>(null!);
  const [isInView, setIsInView] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Skip if already triggered and triggerOnce is true
    if (triggerOnce && hasTriggered.current) return;

    const observer = getSharedObserver();
    
    const callback = (isIntersecting: boolean) => {
      if (isIntersecting) {
        setIsInView(true);
        if (triggerOnce) {
          hasTriggered.current = true;
          // Unobserve after triggering once
          observer.unobserve(element);
          observerCallbacks.delete(element);
        }
      } else if (!triggerOnce) {
        setIsInView(false);
      }
    };

    observerCallbacks.set(element, callback);
    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observerCallbacks.delete(element);
    };
  }, [threshold, rootMargin, triggerOnce]);

  return [ref, isInView];
}

/**
 * Detect if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Optimized animation variant helper
 * Returns animation props only if not reduced motion
 */
export function useAnimationConfig() {
  const prefersReducedMotion = usePrefersReducedMotion();

  const getAnimationProps = useCallback(
    (config: {
      initial?: object;
      animate?: object;
      transition?: object;
      whileInView?: object;
    }) => {
      if (prefersReducedMotion) {
        return {
          initial: false,
          animate: false,
          transition: { duration: 0 },
        };
      }

      return {
        initial: config.initial,
        animate: config.animate,
        transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1], ...config.transition },
        whileInView: config.whileInView,
      };
    },
    [prefersReducedMotion]
  );

  return { prefersReducedMotion, getAnimationProps };
}

/**
 * Stagger animation calculator - optimized for large lists
 */
export function useStaggerDelay(
  index: number,
  baseDelay: number = 0.05,
  maxDelay: number = 0.5
): number {
  return Math.min(index * baseDelay, maxDelay);
}

/**
 * Debounced resize handler for responsive animations
 */
export function useDebouncedResize(callback: () => void, delay: number = 250): void {
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(callback, delay);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [callback, delay]);
}

/**
 * RAF-based smooth scroll handler
 */
export function useSmoothScroll() {
  const scrollToElement = useCallback((elementId: string, offset: number = 0) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const targetPosition = element.getBoundingClientRect().top + window.scrollY - offset;
    
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
      window.scrollTo(0, targetPosition);
      return;
    }

    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    const duration = 800;
    let startTime: number | null = null;

    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

    const animation = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      const ease = easeOutCubic(progress);

      window.scrollTo(0, startPosition + distance * ease);

      if (progress < 1) {
        requestAnimationFrame(animation);
      }
    };

    requestAnimationFrame(animation);
  }, []);

  return { scrollToElement };
}

/**
 * Lazy load heavy components when near viewport
 */
export function useNearViewport<T extends HTMLElement = HTMLDivElement>(
  distance: number = 200
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNear(entry.isIntersecting);
      },
      { rootMargin: `${distance}px` }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [distance]);

  return [ref, isNear];
}
