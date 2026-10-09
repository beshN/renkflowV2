'use client';

import { useEffect, useState } from 'react';
import { HintTip, Skeleton } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import type { PreferenceChannel, PreferenceMatrix } from '@/lib/notifications/preferences';

type Data = {
  events: Array<{ type: string; label: string; hint: string }>;
  channels: Array<{ key: PreferenceChannel; label: string }>;
  status: Record<PreferenceChannel, { connected: boolean; note: string | null }>;
  preferences: PreferenceMatrix;
};

/** Which events reach you on which channel. Channels that do not deliver yet say so. */
export function NotificationPreferencesPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void requestJson<Data>('/api/v1/me/notification-preferences', { cache: 'no-store' }).then((r) => (r.ok && r.data ? setData(r.data) : setError(r.error || 'Tercihler alınamadı')));
  }, []);

  async function toggle(channel: PreferenceChannel, type: string) {
    if (!data) return;
    const next = { ...data.preferences, [channel]: { ...data.preferences[channel], [type]: !data.preferences[channel][type] } };
    setData({ ...data, preferences: next });
    setSaved(false);
    const r = await requestJson<{ preferences: PreferenceMatrix }>('/api/v1/me/notification-preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    if (r.ok && r.data) { setData((d) => (d ? { ...d, preferences: r.data!.preferences } : d)); setSaved(true); } else setError(r.error || 'Kaydedilemedi');
  }

  return (
    <section className="rf-panel space-y-3 p-4" aria-labelledby="prefs-title">
      <h2 id="prefs-title" className="rf-section-title flex items-center gap-2">Bildirim tercihleri <HintTip text="Kapattığınız olay için uygulama içi bildirim oluşturulmaz. E-posta ve anlık bildirim seçimleri saklanır; bu kanallar bağlandığında uygulanır." /></h2>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {saved && <p role="status" className="text-xs text-muted-foreground">Kaydedildi</p>}
      {!data ? <Skeleton className="h-40" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr>
                <th className="py-2 text-left font-medium">Olay</th>
                {data.channels.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-center font-medium">
                    {c.label}
                    {!data.status[c.key].connected && <span className="block text-[11px] font-normal text-muted-foreground">bağlanmadı</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.type} className="border-t border-border">
                  <td className="py-2 pr-2"><span className="font-medium">{e.label}</span><span className="block text-xs text-muted-foreground">{e.hint}</span></td>
                  {data.channels.map((c) => (
                    <td key={c.key} className="px-2 py-2 text-center">
                      <input type="checkbox" className="h-4 w-4" aria-label={`${e.label} – ${c.label}`} checked={data.preferences[c.key][e.type]} onChange={() => void toggle(c.key, e.type)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.channels.filter((c) => data.status[c.key].note).map((c) => <p key={c.key} className="mt-2 text-xs text-muted-foreground">{c.label}: {data.status[c.key].note}</p>)}
        </div>
      )}
    </section>
  );
}
