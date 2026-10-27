"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Minus, Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { ProductConfigurator } from "@/components/features/product-3d/ProductConfigurator";
import {
  defaultVisualization,
  productMeta,
  PRODUCT_CATALOG,
  ProductKindSchema,
  VisualizationConfigurationSchema,
  type ProductKind,
  type VisualizationConfiguration,
} from "@/lib/features/product-3d/catalog";
import { FAIR_MAX_ITEMS, fairPrivacyNotice, itemSummary } from "@/lib/features/fair/schema";
import { useMarkWorkspaceShell } from "@/lib/shared/hooks/useWorkspacePresence";

type Item = { id: string; configuration: VisualizationConfiguration; image?: string; quantity: number };
type Step = "pick" | "design" | "contact" | "done";
type Contact = { contactName: string; phone: string; email: string; companyName: string; city: string; note: string; privacyAccepted: boolean; marketingConsent: boolean; website: string };

const STORAGE_KEY = "rf.fair.items.v1";
const CATEGORY: Record<string, string> = { roof: "Tavan ve pergola", glass: "Cam sistemi", screen: "Perde ve tente" };
const EMPTY_CONTACT: Contact = { contactName: "", phone: "", email: "", companyName: "", city: "", note: "", privacyAccepted: false, marketingConsent: false, website: "" };

function loadItems(): Item[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((i) => VisualizationConfigurationSchema.safeParse(i?.configuration).success)
      .slice(0, FAIR_MAX_ITEMS)
      .map((i) => ({ id: String(i.id), configuration: i.configuration, image: typeof i.image === "string" ? i.image : undefined, quantity: Math.min(99, Math.max(1, Number(i.quantity) || 1)) }));
  } catch {
    return [];
  }
}
function saveItems(items: Item[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* Private mode or full storage: the list simply does not survive a reload. */
  }
}

/** The 3D capture is 900 px wide; a 480 px preview is plenty for the sales team and keeps the request small. */
function shrink(dataUrl: string, width = 480): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((width * img.height) / img.width);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL("image/jpeg", 0.7);
      resolve(out.length < 290_000 ? out : undefined);
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}

const newId = () => Math.random().toString(36).slice(2, 10);

export function FairConfigurator({ firm, event }: { firm: string; event: string | null }) {
  // A standalone app screen: no site cookie banner over the bottom action bar (the page sets no cookies).
  useMarkWorkspaceShell();
  const [step, setStep] = useState<Step>("pick");
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; kind: ProductKind; configuration: VisualizationConfiguration } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [invalid, setInvalid] = useState("");
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const latest = useRef<{ configuration: VisualizationConfiguration; image?: string } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // A QR code may point at one product (?urun=pergola) or carry a stand/source label (?e=salon-3).
  useEffect(() => {
    const restored = loadItems();
    setItems(restored);
    const params = new URLSearchParams(window.location.search);
    setSource(params.get("e")?.slice(0, 120) || null);
    const kind = ProductKindSchema.safeParse(params.get("urun"));
    if (kind.success) design(kind.data);
    else if (restored.length) setStep("contact");
  }, []);
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, [step]);

  function updateItems(next: Item[]) {
    setItems(next);
    saveItems(next);
  }
  function design(kind: ProductKind, item?: Item) {
    const configuration = item?.configuration ?? defaultVisualization(kind);
    latest.current = { configuration, image: item?.image };
    setEditing({ id: item?.id ?? null, kind, configuration });
    setQuantity(item?.quantity ?? 1);
    setInvalid("");
    setStep("design");
  }
  async function addToList() {
    if (!editing || !latest.current || invalid || adding) return;
    setAdding(true);
    // The preview is captured shortly after the 3D scene redraws; wait a moment for it rather than drop it.
    for (let waited = 0; !latest.current.image && waited < 4000; waited += 200) await new Promise((r) => setTimeout(r, 200));
    setAdding(false);
    const { configuration, image } = latest.current;
    const preview = image ? await shrink(image) : undefined;
    const item: Item = { id: editing.id ?? newId(), configuration, quantity, ...(preview ? { image: preview } : {}) };
    updateItems(editing.id ? items.map((i) => (i.id === editing.id ? item : i)) : [...items, item]);
    setEditing(null);
    setStep("contact");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/public/fair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contact,
          email: contact.email || null,
          companyName: contact.companyName || null,
          city: contact.city || null,
          note: contact.note || null,
          event: source,
          items: items.map(({ configuration, image, quantity }) => ({ configuration, quantity, ...(image ? { image } : {}) })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error === "Geçersiz istek" ? "Lütfen zorunlu alanları kontrol edin." : body.error || "Talebiniz gönderilemedi. Lütfen tekrar deneyin.");
        return;
      }
      setReference(body.reference ?? null);
      updateItems([]);
      setContact(EMPTY_CONTACT);
      setStep("done");
    } catch {
      setError("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }
  const field = <K extends keyof Contact>(key: K) => ({
    value: contact[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContact((c) => ({ ...c, [key]: e.target.value })),
  });
  const full = items.length >= FAIR_MAX_ITEMS;

  return (
    <div ref={top} className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold tracking-wide">{firm || "Ürün tasarla"}</p>
            {event && <p className="truncate text-xs text-muted-foreground">{event}</p>}
          </div>
          {step !== "done" && (
            <button
              type="button"
              className="relative inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm"
              onClick={() => setStep("contact")}
              disabled={!items.length}
              aria-label={`Talep listem, ${items.length} ürün`}
            >
              <ShoppingBag size={16} aria-hidden /> Listem
              <span className="rounded-full bg-foreground px-2 text-xs font-semibold tabular-nums text-background">{items.length}</span>
            </button>
          )}
        </div>
        {step !== "done" && (
          <ol className="mx-auto flex max-w-6xl gap-4 px-4 pb-2 text-xs text-muted-foreground" aria-label="Adımlar">
            {(["pick", "design", "contact"] as const).map((s, i) => (
              <li key={s} aria-current={step === s ? "step" : undefined} className={step === s ? "font-semibold text-foreground" : ""}>
                {i + 1}. {s === "pick" ? "Ürün" : s === "design" ? "Ölçü ve renk" : "İletişim"}
              </li>
            ))}
          </ol>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {step === "pick" && (
          <section aria-labelledby="pick-title" className="space-y-4">
            <div>
              <h1 id="pick-title" className="font-display text-2xl font-semibold">Hangi ürünü tasarlamak istersiniz?</h1>
              <p className="mt-1 text-sm text-muted-foreground">Ürünü seçin, ölçüsünü ve rengini 3D olarak ayarlayın. Fiyat teklifiniz size iletilsin.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PRODUCT_CATALOG.map((p) => (
                <button
                  key={p.kind}
                  type="button"
                  disabled={full}
                  className="flex min-h-24 flex-col items-start gap-1 rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary focus-visible:border-primary disabled:opacity-50"
                  onClick={() => design(p.kind)}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{CATEGORY[p.category]}</span>
                  <span className="text-base font-semibold">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.details.slice(0, 2).join(" · ")}</span>
                </button>
              ))}
            </div>
            {full && <p className="text-sm text-muted-foreground">Bir talepte en fazla {FAIR_MAX_ITEMS} ürün olabilir. Listenizi gönderip yeni talep açabilirsiniz.</p>}
          </section>
        )}

        {step === "design" && editing && (
          <section aria-labelledby="design-title" className="space-y-4">
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Ürün seçimine dön" className="flex h-11 w-11 items-center justify-center rounded-md border border-border" onClick={() => { setEditing(null); setStep(items.length && editing.id ? "contact" : "pick"); }}>
                <ArrowLeft size={16} />
              </button>
              <h1 id="design-title" className="font-display text-xl font-semibold">{productMeta(editing.kind).name}</h1>
            </div>
            <ProductConfigurator
              key={editing.id ?? editing.kind}
              kind={editing.kind}
              value={{ configuration: editing.configuration }}
              onValidationChange={setInvalid}
              onChange={(value) => {
                latest.current = { configuration: value.configuration, image: value.image };
              }}
            />
            <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-1" role="group" aria-label="Adet">
                <button type="button" aria-label="Adedi azalt" className="flex h-11 w-11 items-center justify-center rounded-md border border-border" onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
                <output className="w-14 text-center text-sm tabular-nums" aria-live="polite">{quantity} adet</output>
                <button type="button" aria-label="Adedi artır" className="flex h-11 w-11 items-center justify-center rounded-md border border-border" onClick={() => setQuantity((q) => Math.min(99, q + 1))}><Plus size={16} /></button>
              </div>
              <button type="button" disabled={!!invalid || adding} className="rf-primary-button min-h-11 flex-1 justify-center" onClick={() => void addToList()}>
                {adding ? "Görünüm hazırlanıyor…" : editing.id ? "Değişiklikleri kaydet" : "Listeye ekle"}
              </button>
              {invalid && <p role="alert" className="w-full text-xs text-rose-700 dark:text-rose-300">{invalid}</p>}
            </div>
          </section>
        )}

        {step === "contact" && (
          <section aria-labelledby="contact-title" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-3">
              <h1 id="contact-title" className="font-display text-xl font-semibold">Talep listeniz</h1>
              {!items.length && <p className="text-sm text-muted-foreground">Listeniz boş. Bir ürün seçerek başlayın.</p>}
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
                    {item.image ? (
                      <Image src={item.image} alt={`${productMeta(item.configuration.kind).name} görünümü`} width={96} height={64} unoptimized className="h-16 w-24 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="h-16 w-24 shrink-0 rounded bg-muted" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{itemSummary(item)}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: item.configuration.bodyColor }} aria-hidden /> Gövde rengi
                      </p>
                    </div>
                    <button type="button" aria-label="Düzenle" className="flex h-11 w-11 items-center justify-center rounded-md border border-border" onClick={() => design(item.configuration.kind, item)}><Pencil size={15} /></button>
                    <button type="button" aria-label="Listeden çıkar" className="flex h-11 w-11 items-center justify-center rounded-md border border-border" onClick={() => updateItems(items.filter((i) => i.id !== item.id))}><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
              {!full && (
                <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-dashed border-border px-4 text-sm" onClick={() => setStep("pick")}>
                  <Plus size={15} aria-hidden /> Başka ürün ekle
                </button>
              )}
            </div>

            <form onSubmit={submit} className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby="form-title" noValidate={false}>
              <h2 id="form-title" className="font-semibold">İletişim bilgileriniz</h2>
              <p className="text-xs text-muted-foreground">Fiyat teklifinizi hazırlayıp size ulaştıracağız.</p>
              <label className="block text-xs">Ad soyad *<input className="rf-input mt-1 w-full" required autoComplete="name" maxLength={200} {...field("contactName")} /></label>
              <label className="block text-xs">Telefon *<input className="rf-input mt-1 w-full" required type="tel" inputMode="tel" autoComplete="tel" maxLength={40} placeholder="05xx xxx xx xx" {...field("phone")} /></label>
              <label className="block text-xs">E-posta<input className="rf-input mt-1 w-full" type="email" autoComplete="email" maxLength={200} {...field("email")} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs">Firma<input className="rf-input mt-1 w-full" autoComplete="organization" maxLength={200} {...field("companyName")} /></label>
                <label className="block text-xs">Şehir<input className="rf-input mt-1 w-full" autoComplete="address-level2" maxLength={120} {...field("city")} /></label>
              </div>
              <label className="block text-xs">Notunuz<textarea className="rf-input mt-1 min-h-20 w-full" maxLength={1000} placeholder="Uygulama yeri, zaman planı, sorularınız…" {...field("note")} /></label>
              {/* Honeypot: hidden from people and assistive technology. */}
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0 opacity-0" {...field("website")} />
              <details className="rounded border border-border p-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">KVKK aydınlatma metni</summary>
                <div className="mt-2 space-y-2">{fairPrivacyNotice(firm).map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
              </details>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0" checked={contact.privacyAccepted} onChange={(e) => setContact((c) => ({ ...c, privacyAccepted: e.target.checked }))} />
                <span>Aydınlatma metnini okudum; bilgilerimin teklif hazırlamak ve benimle iletişim kurmak için işlenmesini anladım. *</span>
              </label>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={contact.marketingConsent} onChange={(e) => setContact((c) => ({ ...c, marketingConsent: e.target.checked }))} />
                <span>Kampanya ve yeniliklerden telefon, SMS ve e-posta ile haberdar olmak istiyorum (isteğe bağlı).</span>
              </label>
              {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
              <button type="submit" disabled={busy || !items.length} className="rf-primary-button min-h-11 w-full justify-center">
                {busy ? "Gönderiliyor…" : "Fiyat teklifi iste"}
              </button>
            </form>
          </section>
        )}

        {step === "done" && (
          <section className="mx-auto max-w-md space-y-4 py-10 text-center" aria-live="polite">
            <CheckCircle2 size={48} className="mx-auto text-emerald-600" aria-hidden />
            <h1 className="font-display text-2xl font-semibold">Talebiniz alındı</h1>
            {reference && <p className="text-sm">Talep numaranız: <strong className="font-mono">{reference}</strong></p>}
            <p className="text-sm text-muted-foreground">Seçtiğiniz ürünler için fiyat teklifinizi hazırlayıp en kısa sürede sizinle iletişime geçeceğiz. Teşekkür ederiz!</p>
            <button type="button" className="rf-primary-button min-h-11 justify-center" onClick={() => { setReference(null); setStep("pick"); }}>Yeni talep oluştur</button>
          </section>
        )}
      </main>
    </div>
  );
}
