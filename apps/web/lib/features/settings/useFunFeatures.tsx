'use client';
import useSWR from 'swr';
import { useId, type ComponentType } from 'react';
import { useOptionalAuth } from '@/lib/context/AuthContext';

export type FunPolicy = { enabled: boolean; canEdit: boolean };
export function useFunPolicy() {
  const auth = useOptionalAuth();
  const publicInstance = useId();
  // No previous tenant's result is used while switching identity or awaiting the policy.
  const key = auth?.isLoading ? null : ['/api/tenant/fun-features', auth?.user?.tenantId ?? '', auth?.user?.id ?? '', auth ? '' : publicInstance];
  return useSWR<FunPolicy>(key, async ([url]: string[]) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Ayar alınamadı');
    return response.json();
  }, { revalidateOnFocus: true, revalidateOnReconnect: true, keepPreviousData: false });
}
export function useFunFeatures() {
  const { data } = useFunPolicy();
  // SWR keeps the last successful data during revalidation errors. Preserve that firm decision.
  // Undefined means this identity has never received a policy, not that games were disabled.
  return data === undefined ? undefined : data.enabled === true;
}

// The child never mounts while disabled/loading/failed: no listeners, timers, imports or game state.
export function withFunFeatures<P extends object>(Component: ComponentType<P>) {
  return function FunFeature(props: P) {
    const enabled = useFunFeatures();
    return enabled ? <Component {...props} /> : null;
  };
}
