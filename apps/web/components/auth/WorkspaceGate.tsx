'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import * as Dialog from '@radix-ui/react-dialog';
import { FileCheck2, LogOut, ShieldAlert } from 'lucide-react';
import { LegalConsentCheckbox } from '@/components/auth/LegalConsentCheckbox';
import { useAuth } from '@/lib/context/AuthContext';
import { LEGAL_CONSENT_REQUIRED_MESSAGE } from '@/lib/features/auth/legal-consent';
import { MFA_CHANGED_EVENT, MFA_SETUP_URL, pathAllowedDuringMfaSetup } from '@/lib/features/auth/mfa-policy';
import { requestJson } from '@/lib/shared/network';

type Gate = { consentRequired: boolean; mfaSetupRequired: boolean };

/**
 * Asks, once per sign-in state, what the workspace needs before it opens: the legal texts (a
 * friendly dialog, e.g. for SSO accounts that never saw the sign-up box) and the two-step sign-in
 * the firm requires of owners and admins (only the account page stays open, sign-out always works).
 * If the check fails or the columns are not migrated yet, nothing is blocked.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [gate, setGate] = useState<Gate | null>(null);

  const load = useCallback(async () => {
    const r = await requestJson<Gate>('/api/v1/me/gate', { cache: 'no-store' }, { timeoutMs: 10000 });
    setGate(r.ok && r.data ? { consentRequired: Boolean(r.data.consentRequired), mfaSetupRequired: Boolean(r.data.mfaSetupRequired) } : null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    void load();
  }, [isAuthenticated, user?.id, user?.tenantId, load]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(MFA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(MFA_CHANGED_EVENT, onChange);
  }, [load]);

  const mfaBlocked = Boolean(gate?.mfaSetupRequired) && !pathAllowedDuringMfaSetup(pathname);
  useEffect(() => {
    if (mfaBlocked) router.replace(MFA_SETUP_URL);
  }, [mfaBlocked, router]);

  return (
    <>
      {gate?.mfaSetupRequired && !mfaBlocked && <MfaRequiredBanner />}
      {mfaBlocked ? <MfaRequiredNotice /> : children}
      {gate?.consentRequired && <ConsentDialog onDone={() => setGate((g) => (g ? { ...g, consentRequired: false } : g))} />}
    </>
  );
}

function MfaRequiredBanner() {
  return (
    <div role="status" className="mx-auto mt-4 flex max-w-4xl items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 md:mx-6">
      <ShieldAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
      <p>
        Firmanız, sahip ve yönetici hesapları için iki adımlı doğrulamayı zorunlu tutuyor. Çalışma alanına geçmek için aşağıdaki
        <strong> İki adımlı doğrulama</strong> bölümünden kurulumu tamamlayın.
      </p>
    </div>
  );
}

function MfaRequiredNotice() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="rf-panel space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldAlert size={18} aria-hidden /> İki adımlı doğrulama gerekli</h2>
        <p className="text-sm text-muted-foreground">Firmanız, sahip ve yönetici hesapları için iki adımlı doğrulamayı zorunlu tutuyor. Kurulumu tamamladığınızda çalışma alanı açılır.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={MFA_SETUP_URL} className="rf-primary-button text-sm">Kuruluma git</Link>
          <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-sm" onClick={() => void signOut({ callbackUrl: '/auth/login' })}><LogOut size={14} aria-hidden /> Çıkış yap</button>
        </div>
      </div>
    </div>
  );
}

function ConsentDialog({ onDone }: { onDone: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) { setError(LEGAL_CONSENT_REQUIRED_MESSAGE); return; }
    setBusy(true);
    setError('');
    const r = await requestJson('/api/v1/me/consent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acceptLegal: true }) });
    setBusy(false);
    if (!r.ok) { setError(r.error || 'Kaydedilemedi. Lütfen tekrar deneyin.'); return; }
    onDone();
  }

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/55" />
        <Dialog.Content
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl outline-none"
        >
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary"><FileCheck2 size={17} aria-hidden /></span>
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-semibold">Devam etmeden önce bir onayınız gerekiyor</Dialog.Title>
                <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
                  Hizmeti kullanmaya devam edebilmeniz için kullanım koşullarını kabul etmeniz ve kişisel verilerinizin nasıl işlendiğini anlatan metni okuduğunuzu onaylamanız gerekir. Metinler yeni sekmede açılır.
                </Dialog.Description>
              </div>
            </div>
            <LegalConsentCheckbox id="workspace-legal-consent" checked={accepted} onChange={setAccepted} />
            {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="rf-secondary-button inline-flex items-center justify-center gap-1" onClick={() => void signOut({ callbackUrl: '/auth/login' })}><LogOut size={14} aria-hidden /> Çıkış yap</button>
              <button type="submit" className="rf-primary-button" disabled={busy}>{busy ? 'Kaydediliyor...' : 'Onaylıyorum ve devam et'}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
