'use client';

import { useState, useEffect, type ReactElement } from 'react';
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

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{ width: typeof width === 'number' ? width : '100%', minHeight }}
        className="animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
      />
    );
  }

  return (
    <ResponsiveContainer width={width} height={height} minHeight={minHeight}>
      {children}
    </ResponsiveContainer>
  );
}
