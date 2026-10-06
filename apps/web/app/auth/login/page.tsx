'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProviders, signIn } from 'next-auth/react';
import { Button } from '@/components/shared/ui/Button';
import { Input } from '@/components/shared/ui/Input';
import { ArrowRight, Layers3, LockKeyhole, ShieldCheck } from 'lucide-react';

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
      const result = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false, callbackUrl });
      if (!result || result.error) {
        setError(result?.code === 'rate_limited'
          ? 'Çok fazla giriş denemesi yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.'
          : 'E-posta veya şifre doğrulanamadı. Bilgilerinizi kontrol edip tekrar deneyin.');
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
    <div className="rf-auth-shell grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden min-h-screen flex-col overflow-hidden bg-[#13212e] px-12 py-10 text-slate-100 lg:flex xl:px-16">
        <Link href="/" className="relative z-10 flex w-fit items-center gap-3" aria-label="RenkFlow ana sayfa">
          <span className="rf-brand-mark flex h-9 w-9 items-center justify-center rounded-md text-lg font-semibold text-white">R</span>
          <span className="text-sm font-semibold tracking-[0.16em]">RENKFLOW</span>
        </Link>
        <div className="relative z-10 my-auto py-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d39970]">Renk Alüminyum · Operasyon merkezi</p>
          <h1 className="mt-7 max-w-lg text-5xl font-medium leading-[1.15] tracking-[-0.04em] xl:text-[56px]">Üretimin her adımı,<br /><span className="text-slate-400">aynı çalışma alanında.</span></h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-slate-400">Müşteri taleplerini, üretim emirlerini ve sevkiyat sürecini ekibinizle birlikte takip edin.</p>
          <div className="mt-12 max-w-md border-y border-white/10 py-5">
            <div className="flex items-center gap-3 text-xs text-slate-300"><Layers3 size={17} className="text-[#d39970]" /> Sipariş<span className="text-slate-600">/</span>Üretim<span className="text-slate-600">/</span>Sevkiyat</div>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 top-[22%] h-[620px] w-[400px] rotate-[24deg] opacity-[0.08]" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="absolute inset-y-0 w-10 border-x border-white bg-white/10" style={{ left: index * 62 }} />)}
        </div>
        <p className="relative z-10 text-[10px] tracking-wide text-slate-500">RENK ALÜMİNYUM · ÜRETİM YÖNETİM SİSTEMİ</p>
      </aside>
      <main className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide lg:invisible"><span className="rf-brand-mark flex h-7 w-7 items-center justify-center rounded text-white">R</span>RENKFLOW</Link>
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Kurumsal erişim</span>
        </div>
        <div className="mx-auto my-auto w-full max-w-[370px] py-12">
          <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-primary"><LockKeyhole size={19} /></div>
          <p className="rf-eyebrow">Çalışma alanınıza erişin</p>
          <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.035em]">Hesabınıza giriş yapın</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Devam etmek için kurumsal hesap bilgilerinizi kullanın.</p>
          <form method="post" onSubmit={handleSubmit} className="mt-8 space-y-5" aria-busy={!ready || loading}>
            <Input type="email" name="email" autoComplete="username" label="E-posta adresi" placeholder="ad@sirket.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={!ready || loading} />
            <div className="space-y-3">
              <Input type="password" name="password" autoComplete="current-password" label="Şifre" value={password} onChange={e => setPassword(e.target.value)} required disabled={!ready || loading} />
              <div className="flex justify-end"><Link href="/auth/forgot-password" className="text-xs font-medium text-primary hover:underline">Şifremi unuttum</Link></div>
            </div>
            {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
            <Button type="submit" variant="primary" className="h-11 w-full gap-2" disabled={!ready} isLoading={loading} loadingText="Giriş yapılıyor…">Çalışma alanına gir <ArrowRight size={16} /></Button>
          </form>
          {googleEnabled && <Button type="button" variant="secondary" className="mt-3 h-11 w-full" disabled={loading} onClick={async () => { try { await signIn('google', { callbackUrl }); } catch { setError('Google ile giriş başlatılamadı.'); } }}>Google ile devam et</Button>}
          <p className="mt-8 border-t border-border pt-6 text-xs leading-6 text-muted-foreground">Yeni bir hesap mı gerekiyor? <Link href="/signup" className="font-medium text-primary hover:underline">Hesap oluşturun</Link></p>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">© {new Date().getFullYear()} RenkFlow · Renk Alüminyum</p>
      </main>
    </div>
  );
}
