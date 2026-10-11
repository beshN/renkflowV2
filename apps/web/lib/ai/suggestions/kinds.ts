import 'server-only';

import type { z } from 'zod';
import type { UserRole } from '@/lib/features/auth/permissions';
import type { Action, FieldGroup, Module } from '@/lib/security/access-matrix';

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
  /** A lucide icon name for the card (detectors set it). */
  icon?: string;
  payloadSchema: z.ZodType<P>;
  /** Roles that see and decide this kind (the same roles that may run the command by hand). */
  roles: readonly UserRole[];
  /**
   * The member's own permission cell this kind needs (a custom role can narrow the base role):
   * the module must be visible to see the card, and the action allowed to approve it.
   */
  access?: { module: Module; action: Action };
  /** Field groups on the card (prices, customer contact): a member who hides any of them never sees it. */
  sensitive?: readonly FieldGroup[];
  editableFields?: readonly EditableField[];
  apply: (tx: any, actor: SuggestionActor, payload: P, suggestion: { id: string; title: string }) => Promise<Record<string, unknown>>;
  /**
   * Looks at the firm's records and files (or expires) this kind's suggestions. Runs when someone
   * who may decide the kind opens the queue, at most once a minute per firm; never writes anything
   * but suggestions.
   */
  refresh?: (actor: SuggestionActor) => Promise<void>;
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
