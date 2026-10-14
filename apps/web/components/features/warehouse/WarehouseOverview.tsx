"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BusinessDialog } from '@/components/shared/ui/BusinessDialog';
import { WAREHOUSE_TYPES } from '@/lib/features/warehouse/setup';
import {
  ArrowRight,
  Boxes,
  MapPin,
  Plus,
  ScanLine,
  ShieldCheck,
  RefreshCw,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
} from "lucide-react";
import { useWarehouse } from "./useWarehouse";
const fmt = (v: any) =>
  Number(v || 0).toLocaleString("tr-TR", { maximumFractionDigits: 3 });
export default function WarehouseOverview() {
  const { data, error, busy, online, refresh, command } = useWarehouse(),
    [query, setQuery] = useState(""),
    [warehouse, setWarehouse] = useState(""),
    [tab, setTab] = useState("warehouses");
  const [create, setCreate] = useState(false),
    [warehouseId, setWarehouseId] = useState(""),
    [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [type, setType] = useState("shelf"),
    [feedback, setFeedback] = useState(""),
    [localError, setLocalError] = useState("");
  const [createWarehouse, setCreateWarehouse] = useState(false);
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseCode, setWarehouseCode] = useState('');
  const [warehouseType, setWarehouseType] = useState('RAW');
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get('create') === 'warehouse') { setCreateWarehouse(true); setWarehouseName(q.get('name')?.slice(0, 100) || ''); setWarehouseCode(q.get('code')?.slice(0, 40) || ''); const type = q.get('type'); if (type && type in WAREHOUSE_TYPES) setWarehouseType(type); } }, []);
  async function addWarehouse(e: React.FormEvent) {
    e.preventDefault(); setLocalError('');
    try {
      const result = await command('save', { name: warehouseName, code: warehouseCode, type: warehouseType });
      setCreateWarehouse(false); setWarehouseName(''); setWarehouseCode('');
      setWarehouse(result.id); setWarehouseId(result.id); setTab('locations');
      setFeedback('Depo eklendi. Şimdi bu depoya raf ekleyebilirsiniz.');
    } catch (e) { setLocalError((e as Error).message); }
  }
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const rows = useMemo(
    () =>
      data?.locations.filter(
        (l: any) =>
          (!warehouse || l.warehouse_id === warehouse) &&
          (!query ||
            (l.code + " " + l.name + " " + l.warehouse_name)
              .toLocaleLowerCase("tr-TR")
              .includes(query.toLocaleLowerCase("tr-TR"))),
      ) || [],
    [data, warehouse, query],
  );
  const writable =
      data && ["owner", "admin", "office"].includes(data.actor.role),
    manager = data && ["owner", "admin"].includes(data.actor.role);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");
    try {
      await command("location.create", { warehouseId, code, name, type });
      setCreate(false);
      setCode("");
      setName("");
      setFeedback(
        "Yeni raf oluşturuldu. Etiket merkezinden raf etiketini yazdırabilirsiniz.",
      );
    } catch (e) {
      setLocalError((e as Error).message);
    }
  }
  async function review(id: string, approve: boolean) {
    setLocalError("");
    try {
      await command("count.review", { id, approve, note: reviews[id] || "" });
      setFeedback(
        approve
          ? "Sayım onaylandı."
          : "Sayım yeniden inceleme için reddedildi.",
      );
    } catch (e) {
      setLocalError((e as Error).message);
    }
  }
  if (!data)
    return (
      <div className="rf-panel py-12 text-center">
        <p role={error ? "alert" : "status"}>
          {error || "Depo çalışma alanı hazırlanıyor…"}
        </p>
        {error && (
          <button onClick={refresh} className="rf-secondary-button mt-5">
            Tekrar dene
          </button>
        )}
      </div>
    );
  const unassigned = data.balances.filter(
    (b: any) =>
      Number(b.quantity) > 0 &&
      data.locations.some(
        (l: any) => l.id === b.location_id && l.location_type === "unassigned",
      ),
  ).length;
  const pending = data.counts.filter((c: any) => c.status === "pending").length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Önce deponuzu ekleyin, ardından raflarını tanımlayın. Stok giriş ve çıkışları tarama terminalindedir.</p>
        <Link href="/warehouse/scan" className="rf-secondary-button"><ScanLine size={17} /> Stok işlemi yap</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Aktif depo",
            value: data.warehouses.length,
            detail: "Fiziksel stok alanı",
            Icon: Boxes,
          },
          {
            label: "Raf & konum",
            value: data.locations.filter(
              (l: any) => l.location_type !== "unassigned",
            ).length,
            detail: "Etiketlenebilir adres",
            Icon: MapPin,
          },
          {
            label: "Yerleştirme bekleyen",
            value: unassigned,
            detail: "Malzeme / depo kaydı",
            Icon: ArrowDownLeft,
          },
          {
            label: "Sayım incelemesi",
            value: pending,
            detail: "Onay bekleyen kayıt",
            Icon: ClipboardCheck,
          },
        ].map(({ label, value, detail, Icon }) => (
          <div key={label} className="rf-stat-card">
            <div className="flex justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                {label}
              </p>
              <Icon size={18} className="text-primary" />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
              {value}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>
      {(error || localError) && (
        <p
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
        >
          {localError || error}
        </p>
      )}
      {feedback && (
        <p
          role="status"
          className="rounded-xl border border-emerald-300 p-4 text-sm"
        >
          {feedback}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="rf-tabs" role="group" aria-label="Depo görünümü">
          {[
            ["warehouses", "Depolar"],
            ["locations", "Raflar"],
            ["moves", "Hareket defteri"],
            ["counts", "Sayım & kontrol"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
              {key === "counts" && pending > 0 ? " · " + pending : ""}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            className="rf-secondary-button"
            aria-label="Depoyu yenile"
            onClick={refresh}
          >
            <RefreshCw size={16} />
          </button>
          {manager && <button className="rf-primary-button" onClick={() => { setLocalError(''); setCreateWarehouse(true); }}><Plus size={17} /> Depo ekle</button>}
          {writable && (
            <button
              className="rf-primary-button"
              disabled={!data.warehouses.length}
              onClick={() => { setLocalError(''); setWarehouseId(warehouse || data.warehouses[0]?.id || ''); setCreate(true); }}
            >
              <Plus size={17} />
              Raf ekle
            </button>
          )}
        </div>
      </div>
      <BusinessDialog open={create} title="Raf ekle" busy={busy} error={localError} onClose={() => setCreate(false)}>
        <form onSubmit={add} className="rf-panel space-y-4">
          <h2 className="rf-section-title">Raf tanımla</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="rf-field">
              Depo
              <select
                aria-label="Depo"
                className="rf-input"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
              >
                <option value="">Depo seçin</option>
                {data.warehouses.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="rf-field">
              Raf kodu
              <input
                className="rf-input"
                placeholder="A-01-03"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={40}
                required
              />
            </label>
            <label className="rf-field">
              Raf adı
              <input
                className="rf-input"
                placeholder="Profil rafı · üçüncü göz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </label>
            <label className="rf-field">
              Konum türü
              <select
                aria-label="Konum türü"
                className="rf-input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="shelf">Depolama rafı</option>
                <option value="receiving">Mal kabul alanı</option>
                <option value="packing">Paketleme alanı</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button className="rf-primary-button" disabled={busy || !online}>
              Rafı oluştur
            </button>
            <button
              type="button"
              className="rf-secondary-button"
              onClick={() => setCreate(false)}
            >
              Vazgeç
            </button>
          </div>
        </form>
      </BusinessDialog>
      <BusinessDialog open={createWarehouse && Boolean(manager)} title="Depo ekle" busy={busy} error={localError} onClose={() => setCreateWarehouse(false)}>
        <form onSubmit={addWarehouse} className="space-y-4">
          <label className="rf-field">Depo adı<input autoFocus required minLength={2} maxLength={100} className="rf-input" value={warehouseName} onChange={e => setWarehouseName(e.target.value)} placeholder="Örn. Ana hammadde deposu" /></label>
          <label className="rf-field">Depoda ne tutulacak?<select className="rf-input" value={warehouseType} onChange={e => setWarehouseType(e.target.value)}>{Object.entries(WAREHOUSE_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <details><summary className="cursor-pointer text-sm text-muted-foreground">Depo kodu (isteğe bağlı)</summary><label className="rf-field mt-3">Kod<input className="rf-input" maxLength={40} value={warehouseCode} onChange={e => setWarehouseCode(e.target.value)} placeholder="Boş bırakırsanız otomatik oluşturulur" /></label></details>
          <div className="flex gap-2"><button className="rf-primary-button" disabled={busy || !online}>Depoyu ekle</button><button type="button" className="rf-secondary-button" disabled={busy} onClick={() => setCreateWarehouse(false)}>Vazgeç</button></div>
        </form>
      </BusinessDialog>
      {tab === 'warehouses' && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Depolar">
        {!data.warehouses.length && <div className="rf-panel sm:col-span-2"><h2 className="font-semibold">İlk deponuzu ekleyin</h2><p className="mt-2 text-sm text-muted-foreground">Depo adı ve türü yeterli. Raf ve etiketleri daha sonra ekleyebilirsiniz.</p>{manager && <button className="rf-primary-button mt-4" onClick={() => setCreateWarehouse(true)}>Depo ekle</button>}</div>}
        {data.warehouses.map((w: any) => <article className="rf-panel space-y-3" key={w.id}><div className="flex items-center gap-2"><Boxes size={19} /><h2 className="font-semibold">{w.name}</h2></div><p className="text-xs text-muted-foreground">{w.code} · {WAREHOUSE_TYPES[w.warehouse_type as keyof typeof WAREHOUSE_TYPES] || w.warehouse_type}</p><p className="text-sm">{data.locations.filter((l: any) => l.warehouse_id === w.id && l.location_type !== 'unassigned').length} raf</p><button className="rf-secondary-button" onClick={() => { setWarehouse(w.id); setWarehouseId(w.id); setTab('locations'); }}>Rafları aç <ArrowRight size={15} /></button></article>)}
      </section>}
      {tab === "locations" && (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="relative min-w-0 flex-1 basis-56">
              <Search
                size={17}
                className="absolute left-3 top-3 text-muted-foreground"
              />
              <input
                className="rf-input w-full pl-10"
                aria-label="Raf ara"
                placeholder="Raf kodu, ad veya depo ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              className="rf-input"
              aria-label="Depo filtresi"
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
            >
              <option value="">Tüm depolar</option>
              {data.warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {rows.map((l: any) => {
              const stock = data.balances.filter(
                (b: any) => b.location_id === l.id && Number(b.quantity) > 0,
              );
              return (
                <article key={l.id} className="rf-location-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="rf-eyebrow">
                        {l.warehouse_code} /{" "}
                        {l.location_type === "unassigned"
                          ? "YERLEŞTİRME"
                          : "RAF"}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold">
                        {l.code === "UNASSIGNED"
                          ? "Yerleştirme bekliyor"
                          : l.code}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {l.name}
                      </p>
                    </div>
                    <MapPin
                      size={19}
                      className={
                        l.location_type === "unassigned"
                          ? "text-amber-600"
                          : "text-primary"
                      }
                    />
                  </div>
                  <div className="my-4 min-h-16 space-y-2 border-t border-border pt-4">
                    {stock.slice(0, 3).map((b: any) => (
                      <div
                        key={b.item_id}
                        className="flex justify-between gap-3 text-xs"
                      >
                        <span className="truncate text-muted-foreground">
                          {b.name}
                        </span>
                        <span className="shrink-0 font-mono">
                          {fmt(b.quantity)} {b.stock_uom}
                        </span>
                      </div>
                    ))}
                    {!stock.length && (
                      <p className="text-xs text-muted-foreground">
                        Bu konumda kayıtlı stok yok.
                      </p>
                    )}
                    {stock.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{stock.length - 3} malzeme
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                    <Link
                      href={
                        "/warehouse/scan?code=" +
                        encodeURIComponent(l.label_code || l.id)
                      }
                      className="text-xs font-semibold text-primary"
                    >
                      Konumu incele
                      <ArrowUpRight size={13} className="ml-1 inline" />
                    </Link>
                    <Link
                      href={"/warehouse/labels?kind=location&id=" + l.id}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Etiket yazdır
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          {!rows.length && (
            <div className="rf-panel py-12 text-center">
              <MapPin className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold">
                {query ? "Aramaya uygun raf yok" : "Raflarınızı tanımlayın"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {query
                  ? "Farklı bir raf kodu veya depo seçin."
                  : "Üretim merkezinde depoyu, ardından burada fiziksel raf adreslerini oluşturun."}
              </p>
              <Link href="/production" className="rf-secondary-button mt-4">
                Depo kurulumu
              </Link>
            </div>
          )}
        </>
      )}
      {tab === "moves" && (
        <section className="rf-panel overflow-hidden !p-0">
          <div className="border-b border-border p-5">
            <h2 className="rf-section-title">Son 100 raf hareketi</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Transfer iki konum hareketi olarak görünür. Üretim ve mal kabulü
              de bu deftere bağlıdır.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="rf-warehouse-table">
              <thead>
                <tr>
                  {[
                    "Zaman / çalışan",
                    "Malzeme",
                    "Konum",
                    "Miktar",
                    "Belge",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.moves.map((m: any) => (
                  <tr key={m.id}>
                    <td>
                      <p>{new Date(m.created_at).toLocaleString("tr-TR")}</p>
                      <small>{m.actor_name || "Sistem"}</small>
                    </td>
                    <td>{m.name}</td>
                    <td>
                      {m.warehouse_code} / {m.location_code}
                    </td>
                    <td
                      className={
                        Number(m.quantity_delta) > 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-amber-700 dark:text-amber-400"
                      }
                    >
                      {Number(m.quantity_delta) > 0 ? "+" : ""}
                      {fmt(m.quantity_delta)} {m.stock_uom}
                    </td>
                    <td>
                      <p className="font-mono text-[10px]">{m.entry_number}</p>
                      <small>{m.note}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.moves.length && (
              <p className="p-10 text-center text-sm text-muted-foreground">
                Raf hareketleri işlem yaptığınızda burada oluşur.
              </p>
            )}
          </div>
        </section>
      )}
      {tab === "counts" && (
        <div className="space-y-4">
          <div className="rf-panel flex items-start gap-3">
            <ShieldCheck size={24} className="shrink-0 text-primary" />
            <p className="text-sm leading-6 text-muted-foreground">
              Sayım güncel raf sürümüne bağlıdır. Sayım sonrası hareket varsa
              yeniden sayım gerekir. Fiziksel profil ve mamul farkı, toplam
              miktarı değiştirerek kapatılamaz.
            </p>
          </div>
          {data.counts.map((c: any) => (
            <article className="rf-panel" key={c.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {c.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      / {c.location_code}
                    </span>
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.counted_by_name} ·{" "}
                    {new Date(c.created_at).toLocaleString("tr-TR")}
                  </p>
                </div>
                <span className="rf-status-pill">
                  {
                    {
                      pending: "İnceleme bekliyor",
                      approved: "Onaylandı",
                      rejected: "Reddedildi",
                    }[c.status as string]
                  }
                </span>
              </div>
              <div className="my-4 grid grid-cols-3 gap-3 rounded-xl bg-accent/50 p-4">
                {[
                  ["Kayıtlı", c.expected_qty],
                  ["Sayılan", c.counted_qty],
                  ["Fark", Number(c.counted_qty) - Number(c.expected_qty)],
                ].map(([label, v]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-2 text-base font-semibold tabular-nums">
                      {fmt(v)} {c.stock_uom}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{c.reason}</p>
              {c.review_note && (
                <p className="mt-2 text-sm">İnceleme: {c.review_note}</p>
              )}
              {manager && c.status === "pending" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <input
                    className="rf-input min-w-0 flex-1 basis-48"
                    aria-label={"İnceleme notu " + c.id}
                    placeholder="İnceleme gerekçesi · en az 5 karakter"
                    value={reviews[c.id] || ""}
                    onChange={(e) =>
                      setReviews({ ...reviews, [c.id]: e.target.value })
                    }
                  />
                  <button
                    className="rf-secondary-button"
                    disabled={
                      busy || !online || (reviews[c.id] || "").trim().length < 5
                    }
                    onClick={() => void review(c.id, false)}
                  >
                    Reddet
                  </button>
                  <button
                    className="rf-primary-button"
                    disabled={
                      busy || !online || (reviews[c.id] || "").trim().length < 5
                    }
                    onClick={() => void review(c.id, true)}
                  >
                    Sayımı onayla
                  </button>
                </div>
              )}
            </article>
          ))}
          {!data.counts.length && (
            <div className="rf-panel py-10 text-center">
              <ClipboardCheck className="mx-auto mb-3 text-primary" />
              <p className="font-medium">Henüz sayım kaydı yok</p>
              <Link href="/warehouse/scan" className="rf-secondary-button mt-4">
                İlk sayımı başlat
              </Link>
            </div>
          )}
        </div>
      )}
      {(data.balances.length >= data.limits.balances ||
        data.lots.length >= data.limits.lots) && (
        <p role="status" className="rf-alert">
          Görünüm kayıt sınırına ulaştı. Belirli malzeme ve lotları etiketle
          doğrudan sorgulayın; bu ekran tüm fabrikanın toplamı olarak
          kullanılmamalı.
        </p>
      )}
    </div>
  );
}
