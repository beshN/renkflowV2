'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/kit';
import { MFA_POLICY_ENABLE_NEEDS_OWN_MFA } from '@/lib/features/auth/mfa-policy';
import { requestJson } from '@/lib/shared/network';

type Policy = { available: boolean; requireForAdmins: boolean; canEdit: boolean; ownMfaEnabled: boolean };

/** Owner-only rule: owners and admins must use two-step sign-in. */
export function MfaPolicySettings() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const r = await requestJson<Policy>('/api/tenant/mfa-policy', { cache: 'no-store' });
    if (r.ok && r.data) { setPolicy(r.data); setError(''); } else setError(r.error || 'Ayar alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function toggle(next: boolean) {
    if (!policy) return;
    setBusy(true); setError(''); setMessage('');
    const r = await requestJson<{ requireForAdmins: boolean }>('/api/tenant/mfa-policy', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requireForAdmins: next }),
    });
    setBusy(false);
    if (!r.ok || !r.data) { setError(r.error || 'Kaydedilemedi'); return; }
    setPolicy({ ...policy, requireForAdmins: r.data.requireForAdmins });
    setMessage(r.data.requireForAdmins
      ? 'Kural açıldı. İki adımlı doğrulaması olmayan yöneticiler bir sonraki açılışta kurulum sayfasına yönlendirilir.'
      : 'Kural kapatıldı.');
  }

  const enableBlocked = Boolean(policy && !policy.requireForAdmins && !policy.ownMfaEnabled);

  return (
    <section className="space-y-4" aria-labelledby="mfa-policy-title">
      <div>
        <h2 id="mfa-policy-title" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={18} aria-hidden /> Giriş güvenliği</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Açıkken firma sahibi ve yöneticiler, iki adımlı doğrulamayı kurmadan çalışma alanını kullanamaz; girişten sonra kurulum sayfasına yönlendirilirler. Diğer çalışanlar etkilenmez.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => void load()}>Yeniden dene</button></p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {!policy ? (!error && <Skeleton className="h-16" />) : !policy.available ? (
        <p className="text-sm text-muted-foreground">Bu ayar bu kurulumda henüz etkin değil.</p>
      ) : (
        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              role="switch"
              aria-checked={policy.requireForAdmins}
              className="mt-0.5 h-4 w-4 shrink-0"
              checked={policy.requireForAdmins}
              disabled={busy || !policy.canEdit || enableBlocked}
              onChange={(e) => void toggle(e.target.checked)}
            />
            <span className="font-medium">Sahip ve yöneticiler için iki adımlı doğrulama zorunlu</span>
          </label>
          {!policy.canEdit && <p className="text-xs text-muted-foreground">Bu ayarı yalnız firma sahibi değiştirebilir.</p>}
          {policy.canEdit && enableBlocked && (
            <p className="rounded-lg bg-muted p-3 text-xs leading-5">
              {MFA_POLICY_ENABLE_NEEDS_OWN_MFA} <Link href="/account" className="font-medium text-primary underline">Hesabım sayfasına git</Link>
            </p>
          )}
          <p className="text-xs text-muted-foreground">Not: Saha uygulaması henüz doğrulama kodu soramadığı için, iki adımlı doğrulama açık hesaplar saha uygulamasına giriş yapamaz.</p>
        </div>
      )}
    </section>
  );
}
