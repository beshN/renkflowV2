'use client';

import { useCallback, useEffect, useState } from 'react';
import { requestJson } from '@/lib/shared/network';

/** Keep a failed request distinct from a genuinely empty operational list. */
export function useApiCollection<T extends { id: string } = { id: string }>(url: string, failureMessage: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const result = await requestJson<{ success: boolean; data: T[] }>(url, { signal, cache: 'no-store' }, { timeoutMs: 15000 });
    if (signal?.aborted) return;
    if (result.ok && result.data?.success && Array.isArray(result.data.data)) {
      setData(result.data.data); setError('');
    } else setError(failureMessage);
    setLoading(false);
  }, [url, failureMessage]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const reload = useCallback(() => load(), [load]);
  return { data, loading, error, reload };
}
