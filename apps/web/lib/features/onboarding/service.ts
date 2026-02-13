import 'server-only';

import { z } from 'zod';
import { withTransaction, sql } from '@/lib/db';
import { ANALYTICS_EVENTS, ONBOARDING_STEP_KEYS } from '@/lib/analytics/event-schema';

const OnboardingStepKeySchema = z.enum(ONBOARDING_STEP_KEYS);

const StepMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const CompleteOnboardingStepInputSchema = z.object({
  stepKey: OnboardingStepKeySchema,
  metadata: z.record(z.string(), StepMetadataValueSchema).optional(),
});

export type OnboardingActor = {
  tenantId: string;
  userId: string;
  role: string;
};

type OnboardingSessionRow = {
  id: string;
  tenant_id: string;
  started_by: string | null;
  started_at: string | Date;
  activated_at: string | Date | null;
  last_step_key: string | null;
  progress_percent: number;
  created_at: string | Date;
  updated_at: string | Date;
};

type OnboardingStepRow = {
  id: string;
  step_key: string;
  completed: boolean;
  completed_at: string | Date;
  completed_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type OnboardingStep = {
  id: string;
  stepKey: (typeof ONBOARDING_STEP_KEYS)[number];
  completed: boolean;
  completedAt: string;
  completedBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingSession = {
  id: string;
  tenantId: string;
  startedBy: string | null;
  startedAt: string;
  activatedAt: string | null;
  lastStepKey: (typeof ONBOARDING_STEP_KEYS)[number] | null;
  progressPercent: number;
  isActivated: boolean;
  completedStepCount: number;
  requiredStepCount: number;
  completedStepKeys: (typeof ONBOARDING_STEP_KEYS)[number][];
  missingStepKeys: (typeof ONBOARDING_STEP_KEYS)[number][];
  steps: OnboardingStep[];
  createdAt: string;
  updatedAt: string;
};

const REQUIRED_STEP_COUNT = ONBOARDING_STEP_KEYS.length;

function normalizeStepKey(value: string | null): (typeof ONBOARDING_STEP_KEYS)[number] | null {
  if (!value) return null;
  return (ONBOARDING_STEP_KEYS as readonly string[]).includes(value)
    ? (value as (typeof ONBOARDING_STEP_KEYS)[number])
    : null;
}

function mapStep(row: OnboardingStepRow): OnboardingStep {
  return {
    id: row.id,
    stepKey: row.step_key as (typeof ONBOARDING_STEP_KEYS)[number],
    completed: row.completed,
    completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at,
    completedBy: row.completed_by,
    metadata: (row.metadata || {}) as Record<string, unknown>,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function calculateProgress(completedStepCount: number): number {
  return Math.min(100, Math.round((completedStepCount / REQUIRED_STEP_COUNT) * 100));
}

async function upsertSession(tx: any, tenantId: string, userId: string): Promise<OnboardingSessionRow> {
  const result = await tx`
    INSERT INTO onboarding_sessions (
      tenant_id,
      started_by,
      started_at,
      progress_percent,
      created_at,
      updated_at
    )
    VALUES (
      ${tenantId},
      ${userId},
      NOW(),
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (tenant_id) DO UPDATE
    SET
      started_by = COALESCE(onboarding_sessions.started_by, EXCLUDED.started_by),
      updated_at = NOW()
    RETURNING *
  `;

  const rows = result as OnboardingSessionRow[];
  if (!rows[0]) {
    throw new Error('Failed to load onboarding session');
  }
  return rows[0];
}

function buildSession(row: OnboardingSessionRow, stepRows: OnboardingStepRow[]): OnboardingSession {
  const steps = stepRows
    .filter((item) => (ONBOARDING_STEP_KEYS as readonly string[]).includes(item.step_key))
    .map(mapStep);

  const completedStepKeys = ONBOARDING_STEP_KEYS.filter((key) =>
    steps.some((step) => step.stepKey === key && step.completed)
  );
  const completedStepCount = completedStepKeys.length;
  const missingStepKeys = ONBOARDING_STEP_KEYS.filter(
    (key) => !completedStepKeys.includes(key)
  );

  const computedProgress = calculateProgress(completedStepCount);
  const isActivated = Boolean(row.activated_at) || completedStepCount === REQUIRED_STEP_COUNT;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    startedBy: row.started_by,
    startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at,
    activatedAt: row.activated_at instanceof Date ? row.activated_at.toISOString() : row.activated_at,
    lastStepKey: normalizeStepKey(row.last_step_key),
    progressPercent: computedProgress,
    isActivated,
    completedStepCount,
    requiredStepCount: REQUIRED_STEP_COUNT,
    completedStepKeys,
    missingStepKeys,
    steps,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

export async function getOnboardingSession(tenantId: string, userId: string): Promise<OnboardingSession> {
  const sessionRow = await upsertSession(sql, tenantId, userId);

  const stepsResult = await sql`
    SELECT *
    FROM onboarding_steps
    WHERE tenant_id = ${tenantId}
    ORDER BY completed_at ASC
  `;
  const stepsRows = stepsResult as OnboardingStepRow[];

  return buildSession(sessionRow, stepsRows);
}

export async function completeOnboardingStep(
  actor: OnboardingActor,
  input: z.infer<typeof CompleteOnboardingStepInputSchema>
): Promise<OnboardingSession> {
  return withTransaction(async (tx) => {
    await upsertSession(tx, actor.tenantId, actor.userId);

    await tx`
      INSERT INTO onboarding_steps (
        tenant_id,
        step_key,
        completed,
        completed_at,
        completed_by,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        ${actor.tenantId},
        ${input.stepKey},
        true,
        NOW(),
        ${actor.userId},
        ${{
          ...input.metadata,
          event: ANALYTICS_EVENTS.onboardingStepCompleted,
        }},
        NOW(),
        NOW()
      )
      ON CONFLICT (tenant_id, step_key) DO UPDATE
      SET
        completed = true,
        completed_at = NOW(),
        completed_by = EXCLUDED.completed_by,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;

    const completedStepsResult = await tx`
      SELECT step_key
      FROM onboarding_steps
      WHERE tenant_id = ${actor.tenantId}
        AND completed = true
    `;
    const completedSteps = completedStepsResult as Array<{ step_key: string }>;
    const completedStepCount = completedSteps.filter((row) =>
      (ONBOARDING_STEP_KEYS as readonly string[]).includes(row.step_key)
    ).length;

    const progressPercent = calculateProgress(completedStepCount);
    const shouldActivate = completedStepCount === REQUIRED_STEP_COUNT;

    await tx`
      UPDATE onboarding_sessions
      SET
        last_step_key = ${input.stepKey},
        progress_percent = ${progressPercent},
        activated_at = CASE
          WHEN ${shouldActivate}
            THEN COALESCE(activated_at, NOW())
          ELSE activated_at
        END,
        updated_at = NOW()
      WHERE tenant_id = ${actor.tenantId}
    `;

    const [sessionResult, stepsResult] = await Promise.all([
      tx`
        SELECT *
        FROM onboarding_sessions
        WHERE tenant_id = ${actor.tenantId}
        LIMIT 1
      `,
      tx`
        SELECT *
        FROM onboarding_steps
        WHERE tenant_id = ${actor.tenantId}
        ORDER BY completed_at ASC
      `,
    ]);

    const sessionRows = sessionResult as OnboardingSessionRow[];
    const stepRows = stepsResult as OnboardingStepRow[];
    const sessionRow = sessionRows[0];
    if (!sessionRow) {
      throw new Error('Failed to refresh onboarding session');
    }

    return buildSession(sessionRow, stepRows);
  });
}
