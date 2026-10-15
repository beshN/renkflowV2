'use client';

import { Suspense } from 'react';
import { PageHeader, Skeleton } from '@/components/kit';
import { AssistantCommand } from '@/components/features/ai/AssistantCommand';
import { SuggestionsPanel } from '@/components/features/ai/SuggestionsPanel';
import { AssistantStatus } from '@/components/features/ai/AssistantStatus';
import { ExtractPanel } from '@/components/features/ai/ExtractPanel';

export default function AssistantPage() {
  return (
    <div className="rf-page mx-auto w-full max-w-6xl space-y-6">
      <PageHeader eyebrow="Çalışma alanı" title="Asistan" hint="Kayıtlarınızı inceleyin, sorularınızı sorun ve işlemlerinizi tek yerden hazırlayın." />
      <AssistantStatus />
      <Suspense fallback={<Skeleton className="h-24" />}><AssistantCommand /></Suspense>
      <details className="group rounded-xl border border-border bg-card">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold marker:text-muted-foreground">Mesaj veya belgeden kayıt hazırlayın<span className="mt-1 block pl-4 text-xs font-normal text-muted-foreground">Müşteri mesajı, tedarikçi teklifi ve sayım listeleri</span></summary>
        <div className="border-t border-border p-2 sm:p-4"><ExtractPanel /></div>
      </details>
      <SuggestionsPanel />
    </div>
  );
}
