/** Browser-safe quotation editor visibility. APIs independently check RBAC. */
export function canEditQuotation(role?: string) { return role !== undefined && ['owner', 'admin', 'office'].includes(role); }
