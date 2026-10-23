'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

import { AuthFrame } from '@/components/app-core/AuthFrame';
import { Input } from '@/components/shared/ui/Input';
import { Button } from '@/components/shared/ui/Button';

export default function SSOVerifyPage() {
  const router = useRouter();
  const attemptedRef = useRef(false);
  const credentials = useRef<{ email: string; ticket: string } | null>(null);
  const [needsOtp, setNeedsOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  async function finish(code?: string) {
    if (!credentials.current) return;
    setBusy(true);
    setError('');
    try {
      const result = await signIn('credentials', { ...credentials.current, ...(code ? { otp: code } : {}), redirect: false });
      if (result?.code === 'otp_required') { setNeedsOtp(true); return; }
      if (result?.code === 'otp_invalid') { setError('Kod doğrulanamadı. Güncel kodu veya kullanılmamış kurtarma kodunu girin.'); setOtp(''); return; }
      if (!result || result.error) { credentials.current = null; router.replace('/auth/login?error=sso_expired'); return; }
      credentials.current = null;
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Giriş hizmetine ulaşılamadı. Tekrar deneyebilirsiniz.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const email = fragment.get('email') || query.get('email');
    const ticket = fragment.get('ticket') || query.get('ticket');
    window.history.replaceState(null, '', window.location.pathname);

    if (!email || !ticket) {
      router.replace('/auth/login');
      return;
    }

    credentials.current = { email, ticket };
    void finish();
    // The ticket is read once and removed from the URL; retries use the memory-only copy.
  }, [router]);

  function submit(event: FormEvent) { event.preventDefault(); void finish(otp); }

  return (
    <AuthFrame title="Kurumsal Giriş Doğrulaması" description="SSO doğrulama adımı tamamlanıyor, birkaç saniye içinde yönlendirileceksin.">
      {needsOtp ? <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
        <Input label="Doğrulama kodu" autoComplete="one-time-code" autoFocus value={otp} onChange={event => setOtp(event.target.value)} required minLength={6} maxLength={20} disabled={busy} hint="Doğrulama uygulamasındaki güncel kod veya kurtarma kodunuz." />
        <Button type="submit" isLoading={busy}>Girişi tamamla</Button>
      </form> : <p className="text-sm text-slate-600 dark:text-slate-400">Kimlik bilgileri güvenli şekilde doğrulanıyor...</p>}
      {error && <div role="alert" className="mt-4 space-y-3 text-sm text-rose-600 dark:text-rose-300"><p>{error}</p>{!needsOtp && <Button type="button" disabled={busy} onClick={() => void finish()}>Tekrar dene</Button>}</div>}
    </AuthFrame>
  );
}
