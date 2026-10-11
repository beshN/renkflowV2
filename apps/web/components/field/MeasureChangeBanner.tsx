'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ruler } from 'lucide-react';

type Change = { surveyId: string; leadId: string; leadNumber: string; changes: Array<{ key: string; label: string; before: unknown; after: unknown }> };
const show = (v: unknown) => (v === null || v === undefined ? '—' : v === true ? 'Evet' : v === false ? 'Hayır' : String(v));

/** Warns on a quote when its survey measures changed after the quote was made. */
export function MeasureChangeBanner({ quotationId }: { quotationId: string }) {
  const [changes, setChanges] = useState<Change[]>([]);
  useEffect(() => {
    let alive = true;
    // A role without the CRM module gets 403: then there is simply nothing to show.
    void fetch(`/api/v1/leads/quote-changes/${quotationId}`, { cache: 'no-store' })
      .then(async (r) => (r.ok ? ((await r.json()) as { changes: Change[] }).changes : []))
      .then((c) => { if (alive) setChanges(c); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [quotationId]);
  if (!changes.length) return null;
  return (
    <div role="alert" className="rf-panel space-y-1 border-amber-600/40 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300"><Ruler size={16} aria-hidden /> Ölçüler teklif hazırlandıktan sonra değişti</p>
      {changes.map((c) => (
        <p key={c.surveyId} className="text-xs">
          <Link href={`/leads?open=${c.leadId}`} className="text-primary underline">{c.leadNumber}</Link>:{' '}
          {c.changes.map((d) => `${d.label} ${show(d.before)} → ${show(d.after)}`).join(' · ')}. Teklifi revize etmeyi düşünün.
        </p>
      ))}
    </div>
  );
}
