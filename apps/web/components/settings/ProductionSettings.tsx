'use client';

import { useEffect, useState } from 'react';
import { requestJson } from '@/lib/shared/network';
import { SkeletonRows } from '@/components/kit';

type Member = { id: string; name: string | null; email: string; role: string };
type Settings = { available: boolean; leadUserId: string | null; leadLeft: boolean; members: Member[] };
const ROLE: Record<string, string> = { owner: 'Sahip', admin: 'Yönetici', office: 'Ofis', worker: 'Usta' };

/** The default production lead: who gets the work orders opened when a quote becomes an order. */
export function ProductionSettings() {
  const [data, setData] = useState<Settings | null>(null);
  const [lead, setLead] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void requestJson<Settings>('/api/v1/settings/production').then((r) => {
      if (r.ok && r.data) {
        setData(r.data);
        setLead(r.data.leadUserId ?? '');
      } else setError(r.error || 'Üretim ayarları alınamadı');
    });
  }, []);

  if (!data) return error ? <p role="alert" className="text-sm">{error}</p> : <SkeletonRows rows={3} />;
  return (
    <section className="space-y-3" aria-labelledby="production-settings-title">
      <h2 id="production-settings-title" className="text-lg font-semibold">Üretim sorumlusu</h2>
      <p className="text-sm text-muted-foreground">
        Teklif siparişe dönüşünce yapılandırılmış kalemler için açılan üretim emirleri bu kişiye atanır ve kişiye bildirim gider.
        Seçilmezse emir, siparişe dönüştüren kişiye atanır.
      </p>
      {!data.available ? (
        <p className="text-sm text-muted-foreground">Bu ayar bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor).</p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setDone('');
            try {
              const r = await requestJson<{ leadUserId: string | null }>('/api/v1/settings/production', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadUserId: lead || null }),
              });
              if (r.ok) setDone('Kaydedildi.');
              else setError(r.error || 'Kaydedilemedi');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block min-w-64 flex-1 text-xs">Varsayılan üretim sorumlusu
            <select className="rf-input mt-2 w-full" value={lead} onChange={(e) => { setLead(e.target.value); setDone(''); }}>
              <option value="">Tanımlı değil (siparişe dönüştüren kişi)</option>
              {data.leadLeft && data.leadUserId && lead === data.leadUserId && <option value={data.leadUserId}>Ekipten ayrılmış kişi (değiştirin)</option>}
              {data.members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email} · {ROLE[m.role] ?? m.role}</option>)}
            </select>
          </label>
          <button className="rf-primary-button" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </form>
      )}
      {data.leadLeft && lead === data.leadUserId && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">Seçili üretim sorumlusu artık ekipte değil: siparişe dönüşte üretim emirleri açılmaz, kalemler bekler. Yeni bir kişi seçin.</p>
      )}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{done}</p>}
    </section>
  );
}
