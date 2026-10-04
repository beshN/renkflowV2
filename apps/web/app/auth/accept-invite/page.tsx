'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

import { AuthFrame } from '@/components/app-core/AuthFrame';
import { requestJson } from '@/lib/shared/network';

type InvitationData = {
  email: string;
  tenantName: string;
  role: string;
  existingUser: boolean;
};

type ValidationState = 'checking' | 'valid' | 'invalid';

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [status, setStatus] = useState<ValidationState>('checking');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setError('Davet bağlantısı eksik veya geçersiz.');
      return;
    }

    let active = true;

    (async () => {
      const result = await requestJson<{
        valid?: boolean;
        error?: string;
        email?: string;
        tenantName?: string;
        role?: string;
        existingUser?: boolean;
      }>(`/api/tenant/invite/validate?token=${token}`, undefined, {
        timeoutMs: 15000,
        fallbackError: 'Davet dogrulanamadi.',
      });
      if (!active) return;

      const payload = result.data;

      if (!payload?.valid) {
        setStatus('invalid');
        setError(result.error || payload?.error || 'Davet baglantisi dogrulanamadi.');
        return;
      }

      setInvitation({
        email: payload.email || '',
        tenantName: payload.tenantName || '',
        role: payload.role || 'member',
        existingUser: Boolean(payload.existingUser),
      });
      setStatus('valid');
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const handleAccept = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!invitation) {
      setError('Davet verisi bulunamadı.');
      return;
    }

    if (!invitation.existingUser && name.trim().length < 2) {
      setError('Ad soyad en az 2 karakter olmalı.');
      return;
    }

    if (!invitation.existingUser && password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      return;
    }

    setLoading(true);
    setError('');

    const result = await requestJson('/api/tenant/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name: name.trim(), password }),
    }, {
      timeoutMs: 20000,
      fallbackError: 'Davet kabul islemi tamamlanamadi.',
    });

    if (!result.ok) {
      setLoading(false);
      setError(result.error || 'Davet kabul edilemedi.');
      return;
    }

    if (invitation.existingUser) {
      router.push('/auth/login');
      return;
    }

    const signInResult = await signIn('credentials', {
      email: invitation.email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!signInResult || signInResult.error) {
      router.push('/auth/login');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  if (status === 'checking') {
    return (
      <AuthFrame title="Davet Kontrolü" description="Davet bağlantısı ve üyelik bilgileri doğrulanıyor.">
        <p className="text-sm text-slate-600 dark:text-slate-400">Lütfen bekleyin...</p>
      </AuthFrame>
    );
  }

  if (status === 'invalid' || !invitation) {
    return (
      <AuthFrame
        title="Davet Kullanılamıyor"
        description={error || 'Bu davet bağlantısı geçersiz veya süresi dolmuş durumda.'}
        footer={
          <Link href="/auth/login" className="font-semibold text-slate-900 hover:underline dark:text-slate-100">
            Giriş ekranına git
          </Link>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">Yeni bir davet bağlantısı oluşturulmalıdır.</p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Davetini Tamamla"
      description={`${invitation.tenantName} ekibine ${invitation.role} rolüyle katılmak üzeresin.`}
      footer={
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Davet edilen e-posta: <span className="font-semibold text-slate-900 dark:text-slate-100">{invitation.email}</span>
        </p>
      }
    >
      <form method="post" className="space-y-3" onSubmit={handleAccept}>
        {!invitation.existingUser ? (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Ad Soyad
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                type="text"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Şifre
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={6}
                required
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Mevcut hesabın bulundu. Daveti onayladıktan sonra normal giriş adımıyla devam edebilirsin.
          </p>
        )}

        {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
        >
          {loading ? 'Davet işleniyor...' : 'Davetle Katıl'}
        </button>
      </form>
    </AuthFrame>
  );
}
