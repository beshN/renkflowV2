'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

import { AuthFrame } from '@/components/app-core/AuthFrame';

export default function SSOVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const email = searchParams.get('email');
    const ticket = searchParams.get('ticket');

    if (!email || !ticket) {
      router.push('/auth/login');
      return;
    }

    (async () => {
      const result = await signIn('credentials', {
        email,
        ticket,
        redirect: false,
      });

      if (!result || result.error) {
        router.push('/auth/login');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    })();
  }, [router, searchParams]);

  return (
    <AuthFrame title="Kurumsal Giriş Doğrulaması" description="SSO doğrulama adımı tamamlanıyor, birkaç saniye içinde yönlendirileceksiniz.">
      <p className="text-sm text-slate-600 dark:text-slate-400">Kimlik bilgileri güvenli şekilde doğrulanıyor...</p>
    </AuthFrame>
  );
}
