/**
 * Who may open a stored file through /api/storage/content. Pure: the route looks up which records
 * point at the key and passes them in; this decides. A file is served when one of the records that
 * own it is one the person may see, with the same module rules (job preset and custom role matrix
 * included) and field hiding as the record's own screen:
 *
 * - order documents (`documents`, the order's attachments) and finance documents (`order_documents`:
 *   invoice, receipt, contract, delivery note) are commercial papers that carry prices. They need the
 *   orders module and visible prices (like /api/orders/documents/[id]/content); never the worker.
 * - production files (technical drawings, shop-floor photos) need the production module; a worker
 *   only those of a job assigned to them.
 * - a person's own upload (`uploads/<firm>/<person>/…`) stays readable by that person.
 *
 * Key prefixes name the module that writes them. A key under a prefix this route does not know is
 * refused to a narrowed role (job preset or custom role); owners, admins and base-role presets keep
 * today's answer, which still requires a record above.
 */
import type { UserRole } from '@/lib/auth/permissions';
import { can, type FieldGroup, type Matrix, type Module } from '@/lib/security/access-matrix';

export type ContentActor = {
  userId: string;
  tenantId: string;
  role: UserRole;
  /** Set for a job preset or custom role: its matrix decides on top of the base role. */
  narrowed?: { permissions: Matrix; hidden: FieldGroup[] } | null;
  /** Field groups the person's role hides. */
  hidden: FieldGroup[];
};

/** A record that points at the stored key. */
export type FileOwner =
  | { kind: 'order_document' }
  | { kind: 'finance_document' }
  | { kind: 'production_file'; assignedToActor: boolean };

/** Prefixes the app writes (lib/storage callers) and the module whose records own them. */
export const STORAGE_PREFIX_MODULES: Array<{ prefix: string; module: Module | null; financial: boolean }> = [
  { prefix: 'orders/', module: 'orders', financial: true }, // order attachments and finance documents
  { prefix: 'production/', module: 'production', financial: false }, // technical drawings, shop-floor photos
  { prefix: 'uploads/', module: null, financial: false }, // direct uploads: the record that adopted them decides
];

/** Roles whose base role reads order papers today (finance documents included). */
const COMMERCIAL_BASE: UserRole[] = ['owner', 'admin', 'office', 'accountant'];

export function prefixInfo(key: string) {
  return STORAGE_PREFIX_MODULES.find((p) => key.startsWith(p.prefix)) ?? null;
}

export function ownUpload(actor: Pick<ContentActor, 'tenantId' | 'userId'>, key: string) {
  return key.startsWith(`uploads/${actor.tenantId}/${actor.userId}/`);
}

/** May the person see price-bearing papers (base role and the fields their role hides)? */
export function seesFinancialFields(actor: Pick<ContentActor, 'role' | 'hidden'>) {
  return actor.role !== 'worker' && !actor.hidden.includes('price');
}

const moduleView = (actor: ContentActor, module: Module) => !actor.narrowed || can(actor.narrowed, module, 'view');

function ownerAllows(actor: ContentActor, owner: FileOwner): boolean {
  switch (owner.kind) {
    case 'order_document':
    case 'finance_document':
      return COMMERCIAL_BASE.includes(actor.role) && moduleView(actor, 'orders') && seesFinancialFields(actor);
    case 'production_file':
      if (actor.role === 'worker') return owner.assignedToActor && moduleView(actor, 'production');
      return COMMERCIAL_BASE.includes(actor.role) && moduleView(actor, 'production');
  }
}

export function storageContentAllowed(actor: ContentActor, key: string, owners: FileOwner[]): boolean {
  if (ownUpload(actor, key)) return true;
  if (!prefixInfo(key) && actor.narrowed) return false;
  return owners.some((owner) => ownerAllows(actor, owner));
}
