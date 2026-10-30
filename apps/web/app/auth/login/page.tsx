'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProviders, signIn } from 'next-auth/react';
import { Button } from '@/components/shared/ui/Button';
import { Input } from '@/components/shared/ui/Input';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';

function sanitizeCallback(input: string | null): string {
  if (!input || !input.startsWith('/') || input.startsWith('//') || input.includes('\\')) return '/dashboard';
  return input;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallback(searchParams.get('callbackUrl'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Second step: shown once the password is accepted for an account with two-step sign-in.
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setReady(true);
    getProviders().then(providers => { if (active) setGoogleEnabled(Boolean(providers?.google)); }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', { email: email.trim().toLowerCase(), password, ...(otpStep ? { otp } : {}), redirect: false, callbackUrl });
      if (!result || result.error) {
        if (result?.code === 'otp_required') { setOtpStep(true); return; }
        setError(result?.code === 'rate_limited'
          ? 'Çok fazla giriş denemesi yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.'
          : result?.code === 'otp_invalid'
            ? 'Kod doğrulanamadı. Uygulamadaki güncel kodu ya da kullanılmamış bir kurtarma kodunu girin.'
            : 'E-posta veya şifre doğrulanamadı. Bilgilerinizi kontrol edip tekrar deneyin.');
        if (result?.code === 'otp_invalid') setOtp('');
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('Giriş hizmetine ulaşılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      icon={<LockKeyhole size={18} />}
      eyebrow="Çalışma alanınıza erişin"
      title="RenkFlow’a giriş yapın"
      description="Firmanızın çalışma alanına e-posta adresiniz ve şifrenizle girin."
      footer={<>Yeni bir hesap mı gerekiyor? <Link href="/signup" className="font-medium text-primary hover:underline">Hesap oluşturun</Link></>}
    >
      <form method="post" onSubmit={handleSubmit} className="space-y-5" aria-busy={!ready || loading}>
        <Input type="email" name="email" autoComplete="username" label="E-posta adresi" placeholder="ad@sirket.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={!ready || loading} readOnly={otpStep} />
        {otpStep && (
          <Input type="text" name="otp" inputMode="numeric" autoComplete="one-time-code" autoFocus label="Doğrulama kodu" hint="Doğrulama uygulamanızdaki 6 haneli kod ya da bir kurtarma kodu." value={otp} onChange={e => setOtp(e.target.value)} required minLength={6} maxLength={20} disabled={loading} />
        )}
        <div className={otpStep ? 'hidden' : 'space-y-3'}>
          <Input type="password" name="password" autoComplete="current-password" label="Şifre" value={password} onChange={e => setPassword(e.target.value)} required disabled={!ready || loading} />
          <div className="flex justify-end"><Link href="/auth/forgot-password" className="text-xs font-medium text-primary hover:underline">Şifremi unuttum</Link></div>
        </div>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
        <Button type="submit" variant="primary" className="group h-11 w-full gap-2" disabled={!ready} isLoading={loading} loadingText="Giriş yapılıyor…">Çalışma alanına gir <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></Button>
      </form>
      {googleEnabled && <Button type="button" variant="secondary" className="mt-3 h-11 w-full" disabled={loading} onClick={async () => { try { await signIn('google', { callbackUrl }); } catch { setError('Google ile giriş başlatılamadı.'); } }}>Google ile devam et</Button>}
    </AuthShell>
  );
}
