'use client';

import type { ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';

type AuthFrameProps = {
  title: string;
  description: string;
  /** Kept for API compatibility; the shared showcase panel replaces the old aside. */
  asideTitle?: string;
  asideDescription?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Secondary auth flows (reset, invite, SSO) on the shared AuthShell layout. */
export function AuthFrame({ title, description, children, footer }: AuthFrameProps) {
  return (
    <AuthShell icon={<KeyRound size={19} />} eyebrow="Hesap erişimi" title={title} description={description} footer={footer}>
      <div className="space-y-4">{children}</div>
    </AuthShell>
  );
}
