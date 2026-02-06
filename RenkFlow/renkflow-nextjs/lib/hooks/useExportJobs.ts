'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type ExportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ExportJobFormat = 'csv' | 'pdf';
export type ExportEntityType = 'orders' | 'customers' | 'analytics';

export interface ExportJob {
  id: string;
  tenantId: string;
  userId: string;
  status: ExportJobStatus;
  progress: number;
  format: ExportJobFormat;
  fileUrl?: string;
  fileSize?: number;
  error?: string;
  createdAt: string | Date;
  completedAt?: string | Date;
}

export interface CreateExportJobInput {
  format: ExportJobFormat;
  entityType: ExportEntityType;
  dateRange?: { start: Date; end: Date };
  filters?: Record<string, unknown>;
  columns?: string[];
}

export interface UseExportJobsOptions {
  pollIntervalMs?: number;
  listLimit?: number;
}

export function useExportJobs(options: UseExportJobsOptions = {}) {
  const { pollIntervalMs = 5000, listLimit = 20 } = options;

  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  const hasActiveJobs = useMemo(
    () => jobs.some((j) => j.status === 'pending' || j.status === 'processing'),
    [jobs]
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/export', { method: 'GET' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || 'Export işleri alınamadı');
        return;
      }
      const nextJobs = Array.isArray(json?.jobs) ? (json.jobs as ExportJob[]) : [];
      setJobs(nextJobs.slice(0, listLimit));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export işleri alınamadı');
    } finally {
      setIsLoading(false);
    }
  }, [listLimit]);

  const createJob = useCallback(async (input: CreateExportJobInput): Promise<ExportJob | null> => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || 'Export başlatılamadı');
        return null;
      }

      const job = json?.job as ExportJob | undefined;
      if (job) {
        setJobs((prev) => [job, ...prev].slice(0, listLimit));
      }
      return job || null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export başlatılamadı');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [listLimit]);

  const downloadJob = useCallback((job: ExportJob) => {
    if (!job.fileUrl) return;
    window.location.href = job.fileUrl;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!hasActiveJobs) {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    if (pollTimerRef.current) return;

    pollTimerRef.current = window.setInterval(() => {
      refresh();
    }, pollIntervalMs);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [hasActiveJobs, pollIntervalMs, refresh]);

  return {
    jobs,
    isLoading,
    error,
    refresh,
    createJob,
    downloadJob,
  };
}
