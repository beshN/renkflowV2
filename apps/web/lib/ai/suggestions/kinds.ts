import 'server-only';

import type { z } from 'zod';
import type { UserRole } from '@/lib/features/auth/permissions';

export type SuggestionActor = { tenantId: string; userId: string; role: UserRole };

/** A field a person may change before approving; the panel renders a small form from these. */
export type EditableField = { key: string; label: string; type: 'number' | 'text'; min?: number; max?: number; unit?: string };

/**
 * One kind of assistant suggestion. The assistant only files the suggestion; `apply` runs when a
 * person approves it, inside the approval transaction, through the kind's own domain command, so
 * the same checks apply as when the person does it by hand.
 */
export type SuggestionKind<P extends Record<string, unknown> = Record<string, unknown>> = {
  kind: string;
  /** Shown on the card, e.g. "Kesim planı". */
  label: string;
  payloadSchema: z.ZodType<P>;
  /** Roles that see and decide this kind (the same roles that may run the command by hand). */
  roles: readonly UserRole[];
  editableFields?: readonly EditableField[];
  apply: (tx: any, actor: SuggestionActor, payload: P, suggestion: { id: string; title: string }) => Promise<Record<string, unknown>>;
};

const KINDS = new Map<string, SuggestionKind<any>>();

export function registerSuggestionKind<P extends Record<string, unknown>>(definition: SuggestionKind<P>) {
  KINDS.set(definition.kind, definition as SuggestionKind<any>);
}

export function suggestionKind(kind: string): SuggestionKind<any> | undefined {
  return KINDS.get(kind);
}

export function suggestionKinds(): SuggestionKind<any>[] {
  return [...KINDS.values()];
}
