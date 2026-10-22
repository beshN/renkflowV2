import { FIELD_GROUPS, MODULES, can, type Access, type FieldGroup, type Module } from '@/lib/security/access-matrix';

/** Generated files cannot be redacted reliably after generation. Preserve the read scope. */
export function officeReadScope(access: Access) {
  return { modules: MODULES.filter(module => can(access, module, 'view')), hidden: [...access.hidden] };
}
export function mayManageAllOfficeTasks(access: Access) {
  return ['owner', 'admin'].includes(access.base) && access.hidden.length === 0 && MODULES.every(module => can(access, module, 'view'));
}
export function mayReadOfficeTask(access: Access, userId: string, task: { created_by: string; access_scope?: unknown }) {
  if (mayManageAllOfficeTasks(access)) return true;
  if (task.created_by !== userId) return false;
  const scope = task.access_scope as { modules?: unknown; hidden?: unknown } | null;
  // Historical outputs have no safe scope to compare; unrestricted managers can still read them.
  if (!scope || !Array.isArray(scope.modules) || !Array.isArray(scope.hidden)) return false;
  if (!scope.modules.every(module => MODULES.includes(module as Module)) || !scope.hidden.every(field => FIELD_GROUPS.includes(field as FieldGroup))) return false;
  const previousHidden = scope.hidden as FieldGroup[];
  return scope.modules.every(module => can(access, module as Module, 'view')) && access.hidden.every(field => previousHidden.includes(field));
}
