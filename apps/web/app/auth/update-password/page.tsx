'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { AuthFrame } from '@/components/app-core/AuthFrame';
import { requestJson } from '@/lib/shared/network';

type VerifyState = 'checking' | 'ready' | 'invalid';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [state, setState] = useState<VerifyState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }

    let active = true;

    (async () => {
      const result = await requestJson<{ valid?: boolean }>(`/api/auth/verify-reset-token?token=${token}`, undefined, {
        timeoutMs: 15000,
      });
      if (!active) return;
      setState(Boolean(result.data?.valid) ? 'ready' : 'invalid');
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifre alanları eşleşmiyor.');
      return;
    }

    setLoading(true);
    setError('');

    const result = await requestJson('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    }, {
      timeoutMs: 20000,
      fallbackError: 'Sifre guncelleme istegi tamamlanamadi.',
    });
    setLoading(false);

    if (!result.ok) {
      setError(
        result.error === 'token_expired'
          ? 'Baglantinin suresi dolmus.'
          : result.error || 'Sifre guncellenemedi.',
      );
      return;
    }

    setSuccess('Şifre güncellendi. Giriş ekranına yönlendiriliyorsun.');
    setTimeout(() => {
      router.push('/auth/login');
    }, 1200);
  };

  if (state === 'checking') {
    return (
      <AuthFrame title="Bağlantı Doğrulanıyor" description="Güvenli sıfırlama bağlantın kontrol ediliyor.">
        <p className="text-sm text-slate-600 dark:text-slate-400">Lütfen bekleyin...</p>
      </AuthFrame>
    );
  }

  if (state === 'invalid') {
    return (
      <AuthFrame
        title="Bağlantı Geçersiz"
        description="Bu şifre sıfırlama bağlantısı kullanılamıyor. Yeni bir talep başlatmalısın."
        footer={
          <Link href="/auth/forgot-password" className="font-semibold text-slate-900 hover:underline dark:text-slate-100">
            Yeni bağlantı talep et
          </Link>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">Eski veya tek kullanımlık linkler güvenlik gereği tekrar açılamaz.</p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Yeni Şifre Oluştur"
      description="Hesabın için güçlü bir şifre belirleyerek erişimini yenile."
      footer={
        <Link href="/auth/login" className="font-semibold text-slate-900 hover:underline dark:text-slate-100">
          Giriş sayfasına dön
        </Link>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Yeni şifre
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            minLength={6}
            required
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Şifre tekrar
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            minLength={6}
            required
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{success}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
        >
          {loading ? 'Şifre güncelleniyor...' : 'Şifreyi Güncelle'}
        </button>
      </form>
    </AuthFrame>
  );
}
