'use client';

import { Suspense } from 'react';
import { PageHeader, Skeleton } from '@/components/kit';
import { AssistantCommand } from '@/components/features/ai/AssistantCommand';
import { SuggestionsPanel } from '@/components/features/ai/SuggestionsPanel';

export default function AssistantPage() {
  return (
    <div className="rf-page space-y-5">
      <PageHeader eyebrow="Asistan" title="Komut" hint="Yazın ya da söyleyin. Sorular sonuç kartı olarak gelir; bir kaydı değiştirecek her şey önce önizleme olur ve siz onaylamadan uygulanmaz." />
      <Suspense fallback={<Skeleton className="h-24" />}><AssistantCommand /></Suspense>
      <SuggestionsPanel />
    </div>
  );
}
