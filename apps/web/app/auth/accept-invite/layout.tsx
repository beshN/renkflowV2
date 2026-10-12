import type { ReactNode } from 'react';
import { authMetadata } from '@/components/layout/pageMeta';

export const metadata = authMetadata('Daveti kabul et');

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
