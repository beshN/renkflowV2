'use client';

import { useEffect, useState } from 'react';
import type { FieldGroup, Matrix } from '@/lib/security/access-matrix';

export type MemberAccessView = { roleKey: string; roleName: string; base: string; permissions: Matrix; hidden: FieldGroup[]; narrowed: boolean };

let pending: Promise<MemberAccessView | null> | null = null;

/** The signed-in member's effective access, fetched once per page load (null until known or on error). */
export function useMemberAccess() {
  const [access, setAccess] = useState<MemberAccessView | null>(null);
  useEffect(() => {
    let alive = true;
    pending ??= fetch('/api/v1/me/access', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<MemberAccessView>) : null))
      .catch(() => null);
    void pending.then((a) => { if (alive) setAccess(a); });
    return () => { alive = false; };
  }, []);
  return access;
}
