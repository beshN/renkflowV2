'use client';
import { useEffect, useState } from 'react';
import {
  Tablet,
  Plus,
  Copy,
  ExternalLink,
  ShieldOff,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  STATION_KINDS,
  STATION_LABELS,
  STATION_DEFAULT_CHECKS,
  type StationKind,
} from '@/lib/features/stations/contract';
type Device = {
  id: string;
  name: string;
  kind: StationKind;
  work_center_code: string | null;
  warehouse_id: string | null;
  instruction_ids: string[];
  checklist_labels: string[];
  version: number;
  paired: boolean;
  last_seen_at: string | null;
  revoked_at: string | null;
};
type Data = {
  devices: Device[];
  centers: { code: string; name: string }[];
  warehouses: { id: string; name: string }[];
  documents: { id: string; title: string }[];
};
const blank = {
  name: '',
  kind: 'cutting' as StationKind,
  workCenterCode: '',
  warehouseId: '',
  instructionIds: [] as string[],
  checklistLabels: STATION_DEFAULT_CHECKS.cutting.join('\n'),
};
export function StationSettings() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Device | null | false>(false),
    [form, setForm] = useState(blank),
    [pair, setPair] = useState<{
      name: string;
      code: string;
      url: string;
    } | null>(null),
    [qr, setQr] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/v1/stations', { cache: 'no-store', signal: abort.signal })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error);
        setData(b.data);
        setError('');
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [refresh]);
  useEffect(() => {
    let active = true;
    if (!pair) {
      setQr('');
      return;
    }
    import('qrcode')
      .then((module) => module.toDataURL(pair.url, { width: 240, margin: 2 }))
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQr('');
      });
    return () => {
      active = false;
    };
  }, [pair]);
  async function command(body: unknown) {
    const r = await fetch('/api/v1/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const b = await r.json();
    if (!r.ok) throw Error(b.error);
    setRefresh((v) => v + 1);
    return b.data;
  }
  function edit(device: Device | null) {
    setPair(null);
    setEditing(device);
    setForm(
      device
        ? {
            name: device.name,
            kind: device.kind,
            workCenterCode: device.work_center_code ?? '',
            warehouseId: device.warehouse_id ?? '',
            instructionIds: device.instruction_ids,
            checklistLabels: device.checklist_labels.join('\n'),
          }
        : { ...blank },
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await command({
        action: 'save',
        id: editing ? editing.id : undefined,
        version: editing ? editing.version : 0,
        definition: {
          ...form,
          workCenterCode:
            form.kind === 'warehouse' ? null : form.workCenterCode,
          warehouseId: form.kind === 'warehouse' ? form.warehouseId : null,
          checklistLabels: form.checklistLabels
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      setEditing(false);
      toast.success('İstasyon ataması kaydedildi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }
  async function issue(device: Device) {
    setBusy(true);
    setError('');
    try {
      const r = await command({
        action: 'pair',
        id: device.id,
        version: device.version,
      });
      setPair({
        name: device.name,
        code: r.code,
        url: window.location.origin + '/station#pair=' + r.code,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kod oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  }
  async function revoke(device: Device) {
    setBusy(true);
    setError('');
    try {
      await command({
        action: 'revoke',
        id: device.id,
        version: device.version,
      });
      setPair(null);
      toast.success('Tablet erişimi kapatıldı.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bağlantı kapatılamadı.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Tablet size={20} /> Sabit istasyon tabletleri
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tableti bir kez bağlayın. Çalışanlar istasyon işlerini PIN girmeden
            yürütür.
          </p>
        </div>
        <button
          onClick={() => edit(null)}
          className="rf-primary-button min-h-11 px-3"
        >
          <Plus size={16} /> Tablet ekle
        </button>
      </div>
      {error && (
        <div role="alert" className="rf-alert">
          {error}{' '}
          <button
            onClick={() => setRefresh((v) => v + 1)}
            className="underline"
          >
            Yenile
          </button>
        </div>
      )}
      {pair && (
        <div className="rf-panel space-y-3 border-primary/30 p-4">
          <h3 className="font-semibold">{pair.name} eşleştirmesi</h3>
          <p className="text-sm text-muted-foreground">
            Kod 10 dakika geçerlidir ve bir kez kullanılabilir. Yeni kod, önceki
            tablet erişimini kapatır. Bu ekranı yalnız bağlanacak tablette açın
            veya QR’ı o tablette okutun.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {qr && (
              <img
                src={qr}
                alt="Tableti istasyona bağlamak için eşleştirme QR kodu"
                width={200}
                height={200}
              />
            )}
            <div className="min-w-0 space-y-3">
              <code className="block break-all text-sm">{pair.code}</code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pair.code);
                    toast.success('Kod kopyalandı.');
                  } catch {
                    setError(
                      'Kod kopyalanamadı. Yukarıdaki kodu seçip kopyalayın.',
                    );
                  }
                }}
                className="rf-secondary-button min-h-11 px-3"
              >
                <Copy size={15} /> Kodu kopyala
              </button>
              <a href={pair.url} className="rf-primary-button min-h-11 px-3">
                <ExternalLink size={15} /> Bu tablette istasyonu aç
              </a>
            </div>
          </div>
          <button className="text-sm underline" onClick={() => setPair(null)}>
            Kodu gizle
          </button>
        </div>
      )}
      {editing !== false && (
        <form onSubmit={save} className="rf-panel space-y-4 p-4">
          <h3 className="font-semibold">
            {editing ? 'İstasyon atamasını düzenle' : 'Tablet tanımı'}
          </h3>
          <label className="block text-sm">
            Tablet adı
            <input
              className="rf-input mt-1 w-full"
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Kesim masası 1"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              İstasyon
              <select
                className="rf-input mt-1 w-full"
                value={form.kind}
                onChange={(e) => {
                  const kind = e.target.value as StationKind;
                  setForm({
                    ...form,
                    kind,
                    workCenterCode: '',
                    warehouseId: '',
                    checklistLabels: STATION_DEFAULT_CHECKS[kind].join('\n'),
                  });
                }}
              >
                {STATION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {STATION_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            {form.kind === 'warehouse' ? (
              <label className="text-sm">
                Depo
                <select
                  required
                  className="rf-input mt-1 w-full"
                  value={form.warehouseId}
                  onChange={(e) =>
                    setForm({ ...form, warehouseId: e.target.value })
                  }
                >
                  <option value="">Depo seçin</option>
                  {data?.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-sm">
                İş merkezi
                <select
                  required
                  className="rf-input mt-1 w-full"
                  value={form.workCenterCode}
                  onChange={(e) =>
                    setForm({ ...form, workCenterCode: e.target.value })
                  }
                >
                  <option value="">İş merkezi seçin</option>
                  {data?.centers.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} · {c.code}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {form.kind !== 'warehouse' && (
            <>
              <label className="block text-sm">
                Kontrol listesi (her satır bir madde)
                <textarea
                  className="rf-input mt-1 min-h-28 w-full py-3"
                  value={form.checklistLabels}
                  onChange={(e) =>
                    setForm({ ...form, checklistLabels: e.target.value })
                  }
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Kesimde reçete ölçüleri, paketlemede adetli malzemeler ayrıca
                  otomatik eklenir. Bu liste üretim kalite kontrollerinin yerine
                  geçmez.
                </span>
              </label>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">
                  Bu istasyonun talimatları
                </legend>
                {data?.documents.length ? (
                  data.documents.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.instructionIds.includes(doc.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            instructionIds: e.target.checked
                              ? [...form.instructionIds, doc.id]
                              : form.instructionIds.filter(
                                  (id) => id !== doc.id,
                                ),
                          })
                        }
                      />
                      {doc.title}
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Bilgi bankasına tüm ekibe açık bir çalışma talimatı ekleyin.
                  </p>
                )}
              </fieldset>
            </>
          )}
          <div className="flex gap-2">
            <button disabled={busy} className="rf-primary-button min-h-11 px-4">
              {busy ? 'Kaydediliyor…' : 'Atamayı kaydet'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className="rf-secondary-button min-h-11 px-4"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}
      {!data && !error ? (
        <p role="status" className="text-sm text-muted-foreground">
          Tabletler yükleniyor…
        </p>
      ) : !data?.devices.length ? (
        <div className="rf-panel border-dashed p-7 text-center text-sm text-muted-foreground">
          Henüz sabit tablet yok. Önce bir tablet tanımlayın, ardından
          eşleştirme koduyla bağlayın.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {data.devices.map((d) => (
            <article
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <h3 className="font-medium">{d.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {STATION_LABELS[d.kind]} ·{' '}
                  {d.work_center_code ??
                    data.warehouses.find((w) => w.id === d.warehouse_id)
                      ?.name}{' '}
                  ·{' '}
                  {d.paired
                    ? 'Bağlı'
                    : d.revoked_at
                      ? 'Erişim kapalı'
                      : 'Eşleştirme bekliyor'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Son bağlantı:{' '}
                  {d.last_seen_at
                    ? new Date(d.last_seen_at).toLocaleString('tr-TR')
                    : 'Henüz bağlanmadı'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => edit(d)}
                  className="rf-secondary-button min-h-11 px-3"
                >
                  Düzenle
                </button>
                <button
                  disabled={busy}
                  onClick={() => issue(d)}
                  className="rf-secondary-button min-h-11 px-3"
                >
                  <RefreshCw size={15} />{' '}
                  {d.paired ? 'Yeniden eşleştir' : 'Eşleştir'}
                </button>
                {d.paired && (
                  <button
                    disabled={busy}
                    onClick={() => revoke(d)}
                    className="rf-secondary-button min-h-11 px-3"
                  >
                    <ShieldOff size={15} /> Erişimi kapat
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
