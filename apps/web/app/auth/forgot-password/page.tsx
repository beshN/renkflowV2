'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

import { AuthFrame } from '@/components/app-core/AuthFrame';
import { requestJson } from '@/lib/shared/network';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const result = await requestJson<{ message?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }, {
      timeoutMs: 20000,
      fallbackError: 'Sifirlama istegi gonderilemedi.',
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error || 'Sifre sifirlama istegi gonderilemedi.');
      return;
    }

    setMessage(result.data?.message || 'E-posta kayitliysa sifirlama baglantisi gonderildi.');
  };

  return (
    <AuthFrame
      title="Şifreni Yenile"
      description="Hesabınla ilişkili e-posta adresini gir; doğrulama bağlantısını güvenli şekilde gönderelim."
      footer={
        <Link href="/auth/login" className="font-semibold text-slate-900 hover:underline dark:text-slate-100">
          Giriş sayfasına dön
        </Link>
      }
    >
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

        {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
        {message ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{message}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
        >
          {loading ? 'Talep işleniyor...' : 'Sıfırlama Linki Gönder'}
        </button>
      </form>
    </AuthFrame>
  );
}
