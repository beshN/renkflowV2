'use client';

import { useEffect, useState } from 'react';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { formatDate } from '@/lib/utils';
type Notice = { id: string; title: string; message: string; createdAt: string; read: boolean };
export default function NotificationsPage() {
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/notifications').then(async response => {
      if (!response.ok) throw new Error('Bildirimler yüklenemedi.');
      const data = await response.json();
      if (active) setRows(data.notifications || []);
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <div className="min-h-screen"><AppleNavbar title="Bildirimler" showSearch={false} />
    <main className="mx-auto max-w-4xl space-y-3 p-4 md:p-6">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading ? <p role="status" className="text-sm text-slate-500">Bildirimler yükleniyor…</p> : !rows.length && !error ? <div className="rf-panel p-8 text-center"><h2 className="font-semibold">Yeni bildirim yok</h2><p className="mt-2 text-sm text-slate-500">Sipariş ve operasyon bildirimleri burada görünür.</p></div> : rows.map(row =>
        <article key={row.id} className="rf-panel p-4"><h2 className="font-semibold">{row.title}</h2><p className="mt-1 text-sm text-slate-500">{row.message}</p><time className="mt-2 block text-xs text-slate-400">{formatDate(row.createdAt)}</time></article>)}
    </main>
  </div>;
}
