'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';

type Fact = { key: string; label: string; value: string; sources: Array<{ label: string; href: string }> };

/** What the firm's records say about this customer, each line with the records it comes from. */
export function CustomerMemoryCard({ customerId }: { customerId: string }) {
  const [facts, setFacts] = useState<Fact[] | null>(null);
  useEffect(() => {
    void requestJson<{ available: boolean; facts: Fact[] }>(`/api/v1/ai/customers/${customerId}`).then((r) => setFacts(r.ok && r.data?.available ? r.data.facts : []));
  }, [customerId]);
  if (!facts || !facts.length) return null;
  return (
    <section className="rf-panel space-y-2 p-4" aria-label="Müşteri hafızası">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><BookOpen size={15} aria-hidden /> Kayıtlara göre</h2>
      <dl className="space-y-1.5">
        {facts.map((f) => (
          <div key={f.key} className="text-sm">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd>{f.value}</dd>
            <dd className="flex flex-wrap gap-1.5 text-xs" aria-label="Kaynak">{f.sources.map((s) => <Link key={s.href + s.label} href={s.href} className="text-primary hover:underline">{s.label}</Link>)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-muted-foreground">Yalnız kayıtlardan; tahmin yok.</p>
    </section>
  );
}
