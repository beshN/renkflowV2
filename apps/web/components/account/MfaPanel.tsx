'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { HintTip, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { MFA_CHANGED_EVENT } from '@/lib/features/auth/mfa-policy';

type MfaState = { available: boolean; enabled: boolean; recoveryCodesLeft: number };
type Setup = { secret: string; qrDataUrl: string };

/** Lets the workspace gate re-check the firm's two-step sign-in rule right after a change. */
const notifyMfaChanged = () => window.dispatchEvent(new Event(MFA_CHANGED_EVENT));

const post = <T,>(body: Record<string, string>) =>
  requestJson<T>('/api/v1/me/mfa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** Two-step sign-in: set up with an authenticator app, keep the recovery codes, turn off with a code. */
export function MfaPanel() {
  const [state, setState] = useState<MfaState | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await requestJson<MfaState>('/api/v1/me/mfa', { cache: 'no-store' });
    if (r.ok && r.data) setState(r.data); else setError(r.error || 'Durum alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(body: Record<string, string>, after: (data: any) => void) {
    setBusy(true);
    setError('');
    const r = await post<any>(body);
    setBusy(false);
    if (!r.ok) { setError(r.error || 'İşlem tamamlanamadı'); return; }
    setCode('');
    after(r.data);
  }

  const start = () => run({ action: 'start' }, (data: Setup) => setSetup(data));
  const confirm = (e: FormEvent) => { e.preventDefault(); void run({ action: 'confirm', code }, (data: { recoveryCodes: string[] }) => { setSetup(null); setRecoveryCodes(data.recoveryCodes); void load(); notifyMfaChanged(); }); };
  const disable = (e: FormEvent) => { e.preventDefault(); void run({ action: 'disable', code }, () => { setRecoveryCodes(null); void load(); notifyMfaChanged(); }); };

  return (
    <section className="rf-panel space-y-3 p-4" aria-labelledby="mfa-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mfa-title" className="rf-section-title flex items-center gap-2">
          İki adımlı doğrulama
          <HintTip text="Girişte şifrenin yanında telefonunuzdaki doğrulama uygulamasının (Google Authenticator, Microsoft Authenticator, 1Password vb.) ürettiği 6 haneli kod da istenir." />
        </h2>
        {state?.enabled && <StatusChip tone="success" label="Açık" />}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}

      {!state ? <Skeleton className="h-16" /> : !state.available ? (
        <p className="text-sm text-muted-foreground">Bu kurulumda henüz etkin değil.</p>
      ) : recoveryCodes ? (
        <div className="space-y-2">
          <p className="text-sm">Açıldı. Telefonunuza erişemezseniz bu kodlarla giriş yapabilirsiniz; her biri bir kez çalışır. <strong>Şimdi güvenli bir yere kaydedin, bir daha gösterilmeyecek.</strong></p>
          <ul className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-3 font-mono text-sm sm:grid-cols-5" aria-label="Kurtarma kodları">
            {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <button type="button" className="rf-secondary-button text-sm" onClick={() => setRecoveryCodes(null)}>Kaydettim</button>
        </div>
      ) : setup ? (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm">1. Doğrulama uygulamasıyla kodu okutun ya da anahtarı elle girin. 2. Uygulamanın gösterdiği kodu yazın.</p>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrDataUrl} alt="Doğrulama uygulaması için QR kod" width={180} height={180} className="rounded-lg border border-border bg-white p-1" />
            <p className="text-xs text-muted-foreground">Anahtar: <code className="break-all font-mono text-foreground">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code></p>
          </div>
          <label className="block text-sm font-medium" htmlFor="mfa-confirm-code">Uygulamadaki 6 haneli kod</label>
          <div className="flex flex-wrap gap-2">
            <input id="mfa-confirm-code" className="rf-input w-40" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required minLength={6} maxLength={7} />
            <button type="submit" className="rf-primary-button text-sm" disabled={busy}>Doğrula ve aç</button>
            <button type="button" className="rf-secondary-button text-sm" onClick={() => setSetup(null)}>Vazgeç</button>
          </div>
        </form>
      ) : state.enabled ? (
        <form onSubmit={disable} className="space-y-2">
          <p className="flex items-center gap-2 text-sm"><ShieldCheck size={16} aria-hidden className="text-emerald-600" /> Girişte kod isteniyor. Kalan kurtarma kodu: {state.recoveryCodesLeft}.</p>
          <label className="block text-sm font-medium" htmlFor="mfa-disable-code">Kapatmak için güncel kod ya da bir kurtarma kodu</label>
          <div className="flex flex-wrap gap-2">
            <input id="mfa-disable-code" className="rf-input w-48" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required minLength={6} maxLength={20} />
            <button type="submit" className="rf-secondary-button text-sm" disabled={busy}>Kapat</button>
          </div>
          <p className="text-xs text-muted-foreground">Saha uygulaması henüz kod soramadığı için, iki adımlı doğrulama açık hesaplar saha uygulamasına giriş yapamaz.</p>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Şifreniz ele geçse bile hesabınıza girilemesin. Özellikle firma sahibi ve yönetici hesapları için önerilir.</p>
          <button type="button" className="rf-primary-button inline-flex items-center gap-1 text-sm" onClick={() => void start()} disabled={busy}><KeyRound size={14} aria-hidden /> Kurmaya başla</button>
        </div>
      )}
    </section>
  );
}
