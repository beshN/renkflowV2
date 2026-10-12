import type { ReactNode } from 'react';
import { authMetadata } from '@/components/layout/pageMeta';

export const metadata = authMetadata('Giriş yap');

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
