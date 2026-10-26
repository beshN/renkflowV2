import { ONBOARDING_STEP_KEYS, type OnboardingStepKey } from '@/lib/analytics/event-schema';

/**
 * First-run setup checklist ("Kurulum"). Each step is derived from the firm's own records
 * (an order exists, a member joined, ...) so it stays right even when the work was done
 * elsewhere; a step recorded in onboarding_steps also counts as done.
 */

/** What the firm's data says about a step: true/false, or null when it could not be read. */
export type OnboardingSignals = Record<OnboardingStepKey, boolean | null>;

export type ChecklistStep = {
  key: OnboardingStepKey;
  title: string;
  why: string;
  href: string;
  cta: string;
  done: boolean;
};

export type OnboardingChecklist = {
  steps: ChecklistStep[];
  completed: number;
  total: number;
  allDone: boolean;
};

export const CHECKLIST_ROLES = ['owner', 'admin'] as const;

export const CHECKLIST_STEPS: Record<OnboardingStepKey, Omit<ChecklistStep, 'key' | 'done'>> = {
  tenant_profile: {
    title: 'Firma bilgilerini girin',
    why: 'Unvanınız ve vergi bilgileriniz teklif ve faturalarda görünür.',
    href: '/settings#fatura',
    cta: 'Firma bilgileri',
  },
  workstation_setup: {
    title: 'İş merkezlerini tanımlayın',
    why: 'Üretim çizelgesi istasyonların kapasitesine göre planlanır.',
    href: '/production?tab=planning',
    cta: 'İş merkezleri',
  },
  first_order_created: {
    title: 'İlk siparişi oluşturun',
    why: 'Üretim, sevkiyat ve fatura siparişten başlar.',
    href: '/new-order',
    cta: 'Yeni sipariş',
  },
  first_operator_invited: {
    title: 'Ekibinizi davet edin',
    why: 'Çalışanlarınız kendilerine atanan işleri kendi ekranlarında görür.',
    href: '/team',
    cta: 'Ekip',
  },
  first_work_order_assigned: {
    title: 'İlk işi bir çalışana atayın',
    why: 'Atanan iş, çalışanın iş listesine düşer ve ilerlemesi takip edilir.',
    href: '/work-orders',
    cta: 'İş emirleri',
  },
};

export function canSeeChecklist(role: string | null | undefined): boolean {
  return (CHECKLIST_ROLES as readonly string[]).includes(role ?? '');
}

/**
 * Builds the checklist. Returns null when nothing could be read at all (every signal unknown and
 * nothing recorded), so the dashboard shows no card rather than a misleading 0/5.
 */
export function buildChecklist(
  signals: Partial<OnboardingSignals>,
  recorded: readonly string[] = [],
): OnboardingChecklist | null {
  const recordedSet = new Set(recorded);
  const known = ONBOARDING_STEP_KEYS.some((key) => typeof signals[key] === 'boolean' || recordedSet.has(key));
  if (!known) return null;

  const steps = ONBOARDING_STEP_KEYS.map((key) => ({
    key,
    ...CHECKLIST_STEPS[key],
    done: signals[key] === true || recordedSet.has(key),
  }));
  const completed = steps.filter((step) => step.done).length;
  return { steps, completed, total: steps.length, allDone: completed === steps.length };
}

/** Combines two signals for one step: true wins, false needs at least one known answer. */
export function anySignal(...values: Array<boolean | null>): boolean | null {
  if (values.some((value) => value === true)) return true;
  return values.some((value) => value === false) ? false : null;
}

/** Per-user, per-firm key for hiding the card in this browser. */
export function dismissKey(userId: string, tenantId: string): string {
  return `rf-onboarding-dismissed:${tenantId}:${userId}`;
}
