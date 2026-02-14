'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AuthFrame } from '@/components/app-core/AuthFrame';
import { DEFAULT_TEMPLATE_KEY, TEMPLATE_DEFINITIONS, type TemplateKey } from '@/lib/config/templates';
import { requestJson } from '@/lib/shared/network';

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [templateKey, setTemplateKey] = useState<TemplateKey>(DEFAULT_TEMPLATE_KEY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const result = await requestJson('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        companyName: companyName.trim(),
        templateKey,
      }),
    }, {
      timeoutMs: 25000,
      fallbackError: 'Kayit istegi su anda tamamlanamadi.',
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error || 'Kayit islemi tamamlanamadi.');
      return;
    }

    setSuccess('Hesabın oluşturuldu. Giriş sayfasına yönlendiriliyorsun.');
    setTimeout(() => {
      router.push('/auth/login');
    }, 1200);
  };

  return (
    <AuthFrame
      title="Kurumsal Hesap Oluştur"
      description="Yeni tenant ortamını dakikalar içinde oluşturarak sipariş ve finans akışlarını tek panelde yönetmeye başla."
      footer={
        <p className="text-slate-600 dark:text-slate-400">
          Zaten hesabın var mı?{' '}
          <Link href="/auth/login" className="font-semibold text-slate-900 hover:underline dark:text-slate-100">
            Giriş ekranına dön
          </Link>
        </p>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
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
          Şirket adı (opsiyonel)
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            type="text"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Sektör şablonu
          <select
            value={templateKey}
            onChange={(event) => setTemplateKey(event.target.value as TemplateKey)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
          >
            {TEMPLATE_DEFINITIONS.map((template) => (
              <option key={template.key} value={template.key}>
                {template.industry}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          E-posta
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
          {loading ? 'Hesap oluşturuluyor...' : 'Hesabı Oluştur'}
        </button>
      </form>
    </AuthFrame>
  );
}
