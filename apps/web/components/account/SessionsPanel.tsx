'use client';

import { useCallback, useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { EmptyState, HintTip, Skeleton, StatusChip, useConfirm } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';

type Session = { id: string; device: string; createdAt: string; lastSeenAt: string; current: boolean };
const when = (iso: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

/** Your open sessions: close one, or all of them (this one too). */
export function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState('');
  const [confirm, confirmDialog] = useConfirm();
  const load = useCallback(async () => {
    const r = await requestJson<{ sessions: Session[] }>('/api/v1/me/sessions', { cache: 'no-store' });
    if (r.ok && r.data) setSessions(r.data.sessions); else setError(r.error || 'Oturumlar alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function close(s: Session) {
    const r = await requestJson(`/api/v1/me/sessions/${s.id}`, { method: 'DELETE' });
    if (!r.ok) { setError(r.error || 'Kapatılamadı'); return; }
    if (s.current) await signOut({ callbackUrl: '/auth/login' }); else await load();
  }
  async function closeAll() {
    if (!(await confirm({ title: 'Tüm oturumlarınız kapatılsın mı?', description: 'Bu cihaz dahil yeniden giriş yapmanız gerekir.', confirmLabel: 'Tümünü kapat' }))) return;
    const r = await requestJson('/api/v1/me/sessions', { method: 'DELETE' });
    if (!r.ok) { setError(r.error || 'Kapatılamadı'); return; }
    await signOut({ callbackUrl: '/auth/login' });
  }

  return (
    <section className="rf-panel space-y-3 p-4" aria-labelledby="sessions-title">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sessions-title" className="rf-section-title flex items-center gap-2">Açık oturumlar <HintTip text="Son 30 günde kullanılan girişler. Şifre sıfırlandığında ya da yönetici hesabınızı pasifleştirdiğinde hepsi kapanır." /></h2>
        <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-sm" onClick={() => void closeAll()}><LogOut size={14} aria-hidden /> Tümünü kapat</button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {!sessions ? <Skeleton className="h-20" /> : sessions.length === 0 ? (
        <EmptyState title="Kayıtlı oturum yok (bu giriş oturum takibinden önce açılmış olabilir)" icon={MonitorSmartphone} />
      ) : (
        <ul className="divide-y divide-border" aria-label="Oturumlar">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <MonitorSmartphone size={16} aria-hidden className="text-muted-foreground" />
              <span className="font-medium">{s.device}</span>
              {s.current && <StatusChip tone="success" label="Bu cihaz" />}
              <span className="flex-1 text-xs text-muted-foreground">açıldı {when(s.createdAt)} · son {when(s.lastSeenAt)}</span>
              <button type="button" className="rf-secondary-button text-xs" onClick={() => void close(s)}>Kapat</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
