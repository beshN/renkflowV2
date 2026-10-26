'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, X } from 'lucide-react';
import { ProgressRing, Skeleton } from '@/components/kit';
import { useAuth } from '@/lib/context/AuthContext';
import { canSeeChecklist, dismissKey, type OnboardingChecklist } from '@/lib/features/onboarding/checklist';
import { cn } from '@/lib/utils';

function readFlag(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeFlag(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* hidden for this visit only */ }
}

/**
 * Dashboard "Kurulum" card (owner/admin): the first five things to set up, each with a link to the
 * page that completes it. Hidden once everything is done or the user closes it; any error hides it.
 */
export function SetupChecklist() {
  const { user } = useAuth();
  const key = user?.id && user.tenantId ? dismissKey(user.id, user.tenantId) : null;
  const allowed = canSeeChecklist(user?.role);
  const [state, setState] = useState<'loading' | 'hidden' | OnboardingChecklist>('loading');

  useEffect(() => {
    if (!allowed || !key || readFlag(key)) { setState('hidden'); return; }
    const controller = new AbortController();
    setState('loading');
    fetch('/api/onboarding/checklist', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = response.ok ? ((await response.json())?.data as OnboardingChecklist | null) : null;
        if (!data || !Array.isArray(data.steps)) return setState('hidden');
        if (data.allDone) { writeFlag(key, 'done'); return setState('hidden'); }
        setState(data);
      })
      .catch(() => { if (!controller.signal.aborted) setState('hidden'); });
    return () => controller.abort();
  }, [allowed, key]);

  if (!allowed || state === 'hidden') return null;
  if (state === 'loading') return <Skeleton className="h-[148px] w-full" />;

  const dismiss = () => {
    if (key) writeFlag(key, 'dismissed');
    setState('hidden');
  };
  const next = state.steps.find((step) => !step.done);

  return (
    <section className="rf-panel space-y-3 p-4" aria-labelledby="rf-setup-title">
      <div className="flex items-start gap-3">
        <ProgressRing size={44} stroke={5} value={state.completed} max={state.total}
          label={`Kurulum: ${state.total} adımdan ${state.completed} tamamlandı`} center={<span className="text-xs">{state.completed}/{state.total}</span>} />
        <div className="min-w-0 flex-1">
          <h2 id="rf-setup-title" className="text-sm font-semibold">Kurulum</h2>
          <p className="text-xs leading-5 text-muted-foreground">
            {next ? <>Sıradaki adım: {next.title.toLocaleLowerCase('tr-TR')}.</> : 'Tüm adımlar tamamlandı.'}
          </p>
        </div>
        <button type="button" onClick={dismiss} aria-label="Kurulum kartını kapat" title="Kapat" className="rf-icon-button grid h-8 w-8 shrink-0 place-items-center">
          <X size={15} aria-hidden />
        </button>
      </div>
      <ol className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-5">
        {state.steps.map((step) => (
          <li key={step.key}>
            <Link href={step.href}
              className={cn('flex h-full items-start gap-2.5 rounded-md border border-border p-2.5 hover:border-primary/40 hover:bg-accent', step.done && 'opacity-70')}>
              <span aria-hidden className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                step.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                {step.done && <Check size={12} />}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-sm font-medium', step.done && 'line-through decoration-muted-foreground/60')}>
                  {step.title}<span className="sr-only">{step.done ? ' (tamamlandı)' : ' (bekliyor)'}</span>
                </span>
                <span className="block text-xs leading-5 text-muted-foreground">{step.why}</span>
                {!step.done && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">{step.cta} <ArrowRight size={12} aria-hidden /></span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
