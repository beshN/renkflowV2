import type { ReactNode } from 'react';
import tr from '@/lib/i18n/locales/tr.json';
import { workspaceMetadata } from '@/components/layout/pageMeta';

export const metadata = workspaceMetadata(tr.track.title);

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
