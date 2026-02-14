'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

import { AuthFrame } from '@/components/app-core/AuthFrame';

function sanitizeCallback(input: string | null): string {
  if (!input) return '/dashboard';
  if (!input.startsWith('/') || input.startsWith('//')) return '/dashboard';
  return input;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => sanitizeCallback(searchParams.get('callbackUrl')), [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (!result || result.error) {
      setError('Giriş doğrulanamadı. Bilgileri kontrol ederek tekrar deneyin.');
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <AuthFrame
      title="Hesabına Giriş Yap"
      description="RenkFlow operasyon paneline erişmek için kurumsal hesabınla devam et."
      footer={
        <p className="text-slate-600 dark:text-slate-400">
          Hesabın yok mu?{' '}
          <Link href="/signup" className="font-semibold text-slate-900 hover:underline dark:text-slate-100">
            Yeni hesap oluştur
          </Link>
        </p>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl })}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          Google ile giriş
        </button>
        <button
          type="button"
          onClick={() => signIn('azure-ad', { callbackUrl })}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          Microsoft ile giriş
        </button>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          E-posta adresi
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
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
            required
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
        >
          {loading ? 'Giriş kontrol ediliyor...' : 'Giriş Yap'}
        </button>
      </form>

      <Link href="/auth/forgot-password" className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-300">
        Şifremi sıfırla
      </Link>
    </AuthFrame>
  );
}
