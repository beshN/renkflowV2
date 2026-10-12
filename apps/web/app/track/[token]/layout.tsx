import type { ReactNode } from 'react';
import { workspaceMetadata } from '@/components/layout/pageMeta';

export const metadata = workspaceMetadata('Sipariş takibi');

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
