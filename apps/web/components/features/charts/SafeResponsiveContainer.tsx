'use client';

import { useState, useEffect, useRef, type ReactElement, type CSSProperties } from 'react';
import { ResponsiveContainer } from 'recharts';

interface SafeResponsiveContainerProps {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  children: ReactElement;
  minHeight?: number;
}

/**
 * A wrapper around Recharts ResponsiveContainer that prevents the
 * "width(-1) and height(-1)" console error by deferring render until
 * the component is mounted on the client and the container has non-zero
 * dimensions.
 */
export function SafeResponsiveContainer({
  width = '100%',
  height = '100%',
  children,
  minHeight = 100,
}: SafeResponsiveContainerProps) {
  const [mounted, setMounted] = useState(false);
  const [hasSize, setHasSize] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const element = wrapperRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setHasSize(rect.width > 1 && rect.height > 1);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [mounted]);

  const resolvedHeight = typeof height === 'number' ? height : minHeight;

  const wrapperStyle: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: `${resolvedHeight}px`,
    minHeight,
  };

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      {!mounted || !hasSize ? (
        <div
          style={{ width: '100%', minHeight, height: `${resolvedHeight}px` }}
          className="animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
        />
      ) : (
        <ResponsiveContainer width="100%" height={resolvedHeight} minHeight={minHeight}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}
