'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Car, MapPinned, Plus, Radio, ShieldAlert } from 'lucide-react';
import { EmptyState, HintTip, PageHeader, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { DOCUMENT_KIND_LABELS, DOC_LEVEL_LABEL, VEHICLE_STATUS_LABELS, VEHICLE_TYPES, VEHICLE_TYPE_LABELS, formatPlate, type DocLevel, type DocumentKind, type VehicleStatus, type VehicleType } from '@/lib/features/fleet/engine';
import { TileMap } from './TileMap';
import { DemoTracking } from './DemoTracking';

type Card = {
  id: string; plate: string; make: string | null; model: string | null; modelYear: number | null; type: VehicleType; status: VehicleStatus; driverName: string | null; odometerKm: number | null;
  alerts: Array<{ kind: string; level: DocLevel; daysLeft: number | null }>; health: 'good' | 'attention' | 'critical'; reasons: string[];
  lastPosition: { at: string; lat: number; lng: number; speedKmh: number | null } | null; devices: number;
};
type Live = { devices: number; vehicles: Array<{ vehicleId: string; plate: string; at: string; lat: number; lng: number; speedKmh: number | null }> };

export const HEALTH: Record<Card['health'], { tone: 'success' | 'warning' | 'danger'; label: string }> = { good: { tone: 'success', label: 'İyi' }, attention: { tone: 'warning', label: 'Dikkat' }, critical: { tone: 'danger', label: 'Kritik' } };
const when = (iso: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

/** The fleet (owner and admins only): vehicle cards with document warnings and health, the live map. */
export function FleetWorkspace() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  // The demo opens by itself while no vehicle has reported a position, so the screen is never an empty map.
  const [demo, setDemo] = useState<boolean | null>(null);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([requestJson<{ vehicles: Card[] }>('/api/v1/vehicles', { cache: 'no-store' }), requestJson<Live>('/api/v1/vehicles?view=live', { cache: 'no-store' })]);
    if (a.ok && a.data) setCards(a.data.vehicles); else setError(a.error || 'Araçlar alınamadı');
    if (b.ok && b.data) setLive(b.data);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!cards) return error ? <p role="alert" className="rf-panel text-sm">{error}</p> : <Skeleton className="h-64" />;
  const docAlerts = cards.reduce((n, c) => n + c.alerts.length, 0);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Yönetim" title="Araç filosu" hint="Yalnız firma sahibi ve yöneticiler görür. Belge bitişine 30, 15 ve 7 gün kala uyarı verir. Konum için araca cihaz bağlanır (cihaz yoksa harita boş kalır; sahte konum gösterilmez)."
        kpis={[{ label: 'araç', value: cards.filter((c) => c.status !== 'sold').length, icon: Car }, { label: 'kritik', value: cards.filter((c) => c.health === 'critical').length, icon: ShieldAlert, tone: cards.some((c) => c.health === 'critical') ? 'danger' : 'neutral' }, { label: 'belge uyarısı', value: docAlerts, icon: AlertTriangle, tone: docAlerts ? 'warning' : 'neutral' }, { label: 'bağlı cihaz', value: live?.devices ?? 0, icon: Radio }]}
        action={<button type="button" className="rf-primary-button inline-flex items-center gap-1 text-sm" onClick={() => setAdding(true)}><Plus size={14} aria-hidden /> Araç ekle</button>} />
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {adding && <NewVehicle onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await load(); }} onError={setError} />}
      {cards.length === 0 ? <EmptyState title="Henüz araç yok" icon={Car} /> : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Araçlar">
          {cards.map((c) => (
            <li key={c.id}>
              <Link href={`/vehicles/${c.id}`} className="rf-panel block space-y-2 p-3 hover:border-primary/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-lg font-semibold tracking-wide">{formatPlate(c.plate)}</p>
                    <p className="truncate text-sm">{[c.make, c.model, c.modelYear].filter(Boolean).join(' ') || '—'}</p>
                    <p className="text-xs text-muted-foreground">{VEHICLE_TYPE_LABELS[c.type]} · {c.driverName ?? 'sürücü yok'}{c.odometerKm !== null ? ` · ${c.odometerKm.toLocaleString('tr-TR')} km` : ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusChip tone={HEALTH[c.health].tone} label={HEALTH[c.health].label} />
                    <StatusChip tone={c.status === 'active' ? 'neutral' : 'muted'} label={VEHICLE_STATUS_LABELS[c.status]} />
                  </div>
                </div>
                {c.alerts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.alerts.map((a) => <StatusChip key={a.kind} tone={a.level === 'expired' || a.level === 'd7' ? 'danger' : 'warning'} label={`${DOCUMENT_KIND_LABELS[a.kind as DocumentKind] ?? a.kind}: ${a.level === 'expired' ? DOC_LEVEL_LABEL.expired : `${a.daysLeft} gün`}`} />)}
                  </div>
                )}
                {c.reasons.filter((r) => !c.alerts.length || !/süresi|bitiyor/.test(r)).length > 0 && <p className="text-xs text-muted-foreground">{c.reasons.filter((r) => !/süresi|bitiyor/.test(r)).join(' · ')}</p>}
                <p className="text-[11px] text-muted-foreground">{c.devices ? (c.lastPosition ? `Son konum ${when(c.lastPosition.at)}` : 'Cihaz bağlı, konum gelmedi') : 'Cihaz bağlı değil'}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section className="space-y-2" aria-labelledby="live-title">
        <h2 id="live-title" className="rf-section-title flex items-center gap-2"><MapPinned size={16} aria-hidden /> Canlı filo haritası <HintTip text="Her aracın son bildirdiği konum. Konum yalnız araca bağlı cihazdan gelir; saklama süresi aşağıdan ayarlanır." /></h2>
        {live && live.vehicles.length ? (
          <TileMap label="Araçların son konumu" markers={live.vehicles.map((v) => ({ id: v.vehicleId, lat: v.lat, lng: v.lng, label: formatPlate(v.plate) }))} />
        ) : null}
        {(demo ?? !live?.vehicles.length) ? <DemoTracking onClose={() => setDemo(false)} /> : (
          <button type="button" className="rf-secondary-button text-sm" onClick={() => setDemo(true)}>Demo takibi göster</button>
        )}
        <Retention onError={setError} />
      </section>
    </div>
  );
}

function NewVehicle({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => Promise<void>; onError: (e: string) => void }) {
  const [f, setF] = useState({ plate: '', make: '', model: '', modelYear: '', type: 'van', odometerKm: '' });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await requestJson('/api/v1/vehicles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, modelYear: f.modelYear ? Number(f.modelYear) : null, odometerKm: f.odometerKm ? Number(f.odometerKm) : null }) });
    if (!r.ok) onError(r.error || 'Kaydedilemedi'); else await onSaved();
  }
  return (
    <form onSubmit={save} className="rf-panel grid gap-2 p-3 sm:grid-cols-3" aria-label="Yeni araç">
      <label className="text-xs">Plaka<input className="rf-input mt-1 w-full font-mono uppercase" required placeholder="34 ABC 123" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} /></label>
      <label className="text-xs">Marka<input className="rf-input mt-1 w-full" value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} /></label>
      <label className="text-xs">Model<input className="rf-input mt-1 w-full" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></label>
      <label className="text-xs">Model yılı<input type="number" className="rf-input mt-1 w-full" value={f.modelYear} onChange={(e) => setF({ ...f, modelYear: e.target.value })} /></label>
      <label className="text-xs">Tür<select className="rf-input mt-1 w-full" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{VEHICLE_TYPES.map((t) => <option key={t} value={t}>{VEHICLE_TYPE_LABELS[t]}</option>)}</select></label>
      <label className="text-xs">Km<input type="number" min={0} className="rf-input mt-1 w-full" value={f.odometerKm} onChange={(e) => setF({ ...f, odometerKm: e.target.value })} /></label>
      <div className="flex gap-2 sm:col-span-3"><button type="submit" className="rf-primary-button text-sm">Kaydet</button><button type="button" className="rf-secondary-button text-sm" onClick={onClose}>Vazgeç</button></div>
    </form>
  );
}

function Retention({ onError }: { onError: (e: string) => void }) {
  const [days, setDays] = useState<number | null | undefined>(undefined);
  useEffect(() => { void requestJson<{ retentionDays: number | null }>('/api/v1/vehicles/settings').then((r) => r.ok && r.data && setDays(r.data.retentionDays)); }, []);
  if (days === undefined) return null;
  async function save(v: string) {
    const value = v === 'forever' ? null : Number(v);
    const r = await requestJson<{ retentionDays: number | null }>('/api/v1/vehicles/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retentionDays: value }) });
    if (r.ok && r.data) setDays(r.data.retentionDays); else onError(r.error || 'Kaydedilemedi');
  }
  return (
    <label className="inline-flex flex-wrap items-center gap-2 text-xs">Konum geçmişi saklama
      <select className="rf-input" value={days === null ? 'forever' : String(days)} onChange={(e) => void save(e.target.value)}>
        {[30, 90, 180, 365, 730].map((d) => <option key={d} value={d}>{d} gün</option>)}
        {days !== null && ![30, 90, 180, 365, 730].includes(days) && <option value={days}>{days} gün</option>}
        <option value="forever">Süresiz</option>
      </select>
      <HintTip text="Süresi geçen konum noktaları her gece silinir. Süresiz seçilirse silinmez." />
    </label>
  );
}
