'use client';

import type { ReactNode } from 'react';
import { PageTransition } from '@/components/animate-ui/components/page-transition';

/** Animate only the changing workspace; navigation and the header stay in place. */
export function RouteTransition({ children, className }: { children: ReactNode; className?: string }) {
  return <PageTransition effect="fade" className={className}>{children}</PageTransition>;
}
