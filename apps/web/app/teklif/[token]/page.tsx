"use client";
import { use, useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, FileText, XCircle } from "lucide-react";
import { ProductDrawing } from "@/components/drawing/ProductDrawing";
import { ColorChip } from "@/components/colors/ColorSwatch";
import { Skeleton, StatusChip } from "@/components/kit";
import { formatCurrency } from "@/lib/utils";
import Image from 'next/image';
import { ProductDialog } from '@/components/features/product-3d/ProductDialog';
import type { ProductVisualization } from '@/lib/features/product-3d/catalog';
import type { AwningConfiguration } from '@/lib/features/awning/configuration';

type Item = { productVisualization?:ProductVisualization|null;awningConfiguration?:AwningConfiguration|null;awningPreview?:string|null; productName: string; description: string | null; quantity: number; unitPrice: number; discountPercent: number; totalPrice: number; color: string | null; widthMm: number | null; heightMm: number | null; family: string | null; parameters: { widthMm: number | null; projectionMm: number | null; mountingHeightMm: number | null } | null };
type Quote = {
  firm: string; quotationNumber: string; revision: number; customerName: string; status: string; decidable: boolean; decidedAt: string | null; decidedBy: string | null;
  validUntil: string | null; currency: string; vatPercent: number; subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number; notes: string | null; terms: string | null; items: Item[];
};

/** The customer's own quote behind an approval link, with one decision: approve or reject, with their name. */
export default function QuoteApproval({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [quote, setQuote] = useState<Quote>();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`/api/v1/public/quotes/${token}`, { cache: "no-store" });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) setError(body.error || "Teklif açılamadı");
    else setQuote(body.data);
  }
  useEffect(() => { void load(); }, [token]);

  async function decide(decision: "accept" | "reject") {
    setBusy(true);
    setError("");
    const r = await fetch(`/api/v1/public/quotes/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, name, note: note || undefined }) });
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(body.error || "Kararınız kaydedilemedi"); return; }
    await load();
  }

  if (error && !quote)
    return <main className="grid min-h-screen place-items-center bg-background p-6"><p role="alert" className="rf-panel max-w-md text-center text-sm">{error}</p></main>;
  if (!quote)
    return <main className="mx-auto min-h-screen max-w-3xl space-y-4 bg-background p-4 pt-10" role="status"><span className="sr-only">Teklif açılıyor</span><Skeleton className="h-10 w-2/3" /><Skeleton className="h-48" /><Skeleton className="h-24" /></main>;

  const done = quote.status === "accepted" || quote.status === "rejected";
  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-6 bg-background p-4 pt-8 sm:p-8 sm:pt-12">
      <header className="space-y-5 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="rf-eyebrow">{quote.firm}</p>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight"><FileText size={24} aria-hidden /> Fiyat teklifi</h1>
          </div>
          <div className="text-sm sm:text-right">
            <p className="break-all font-medium">{quote.quotationNumber}</p>
            <p className="mt-1 text-xs text-muted-foreground">Revizyon {quote.revision} · {quote.currency}</p>
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div><p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Müşteri</p><p className="mt-1 break-words font-semibold">{quote.customerName}</p></div>
          {quote.validUntil && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:mt-0"><CalendarClock size={14} aria-hidden /> {new Date(quote.validUntil + "T00:00:00").toLocaleDateString("tr-TR")} tarihine kadar geçerli</p>}
        </div>
      </header>

      <h2 className="text-base font-semibold">Ürün ve uygulama kapsamı <span className="ml-2 text-xs font-normal text-muted-foreground">{quote.items.length} kalem</span></h2>
      <ul className="space-y-4">
        {quote.items.map((item, i) => (
          <li key={i} className="rf-panel space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold">{i + 1}. {item.productName}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} adet{item.widthMm ? ` · ${item.widthMm}${item.heightMm ? ` × ${item.heightMm}` : ""} mm` : ""}
                  {item.color ? <> · <ColorChip color={item.color} size={14} showName /></> : null}
                </p>
                {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
              </div>
              <p className="text-right text-sm tabular-nums">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Kalem toplamı</span>
                <span className="block font-semibold">{formatCurrency(item.totalPrice, quote.currency)}</span>
                <span className="mt-1 block text-xs text-muted-foreground">Birim: {formatCurrency(item.unitPrice, quote.currency)}</span>
                {item.discountPercent > 0 && <span className="text-xs text-muted-foreground">%{item.discountPercent} indirimli</span>}
              </p>
            </div>
            {item.parameters && <ProductDrawing family={item.family ?? "pergola"} widthMm={item.parameters.widthMm} projectionMm={item.parameters.projectionMm} heightMm={item.parameters.mountingHeightMm} color={item.color} className="h-auto max-h-56 w-full" />}
            {(item.productVisualization?.image||item.awningPreview)&&<Image src={item.productVisualization?.image||item.awningPreview!} alt={`${item.productName} 3D görünümü`} width={900} height={600} unoptimized className="max-h-64 w-full rounded-md bg-[#eceeeb] object-contain"/>}
            {(item.productVisualization||item.awningConfiguration)&&<ProductDialog visualization={item.productVisualization} awningConfiguration={item.awningConfiguration} previewImage={item.awningPreview} readOnly label="Ürünü 3D inceleyin"/>}
          </li>
        ))}
      </ul>

      <section className="rf-panel space-y-1.5 text-sm tabular-nums" aria-label="Toplam">
        <h2 className="mb-4 text-base font-semibold">Teklif toplamı</h2>
        <p className="flex justify-between"><span>Ara toplam</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></p>
        {quote.discountAmount > 0 && <p className="flex justify-between"><span>İndirim</span><span>−{formatCurrency(quote.discountAmount, quote.currency)}</span></p>}
        <p className="flex justify-between text-muted-foreground"><span>KDV %{quote.vatPercent}</span><span>{formatCurrency(quote.taxAmount, quote.currency)}</span></p>
        <p className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Genel toplam</span><span>{formatCurrency(quote.totalAmount, quote.currency)}</span></p>
      </section>

      {(quote.notes || quote.terms) && (
        <section className="rf-panel space-y-2 text-sm">
          {quote.notes && <div><h2 className="mb-2 font-semibold">Teklif açıklaması</h2><p className="whitespace-pre-line">{quote.notes}</p></div>}
          {quote.terms && <div className={quote.notes ? "border-t border-border pt-4" : undefined}><h2 className="mb-2 font-semibold">Ödeme, teslimat ve montaj koşulları</h2><p className="whitespace-pre-line text-muted-foreground">{quote.terms}</p></div>}
        </section>
      )}

      {done ? (
        <section className="rf-panel flex items-center gap-3" role="status">
          <StatusChip tone={quote.status === "accepted" ? "success" : "danger"} icon={quote.status === "accepted" ? BadgeCheck : XCircle} label={quote.status === "accepted" ? "Onaylandı" : "Reddedildi"} />
          <span className="text-sm">{quote.decidedBy}{quote.decidedAt ? ` · ${new Date(quote.decidedAt).toLocaleString("tr-TR")}` : ""}</span>
        </section>
      ) : quote.decidable ? (
        <form className="rf-panel space-y-3" onSubmit={(e) => { e.preventDefault(); void decide("accept"); }}>
          <h2 className="text-base font-semibold">Teklif değerlendirmesi</h2>
          <p className="text-sm text-muted-foreground">Ürün kapsamını ve ticari koşulları inceleyerek kararınızı iletebilirsiniz.</p>
          <label className="block text-sm">Adınız soyadınız
            <input required minLength={2} maxLength={120} autoComplete="name" className="rf-input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">Not (isteğe bağlı)
            <textarea maxLength={1000} className="rf-input mt-1 min-h-16 w-full" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy || name.trim().length < 2} className="rf-primary-button"><BadgeCheck size={15} /> Teklifi onaylıyorum</button>
            <button type="button" disabled={busy || name.trim().length < 2} className="rf-input" onClick={() => void decide("reject")}>Reddet</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Kararınız adınız, tarih-saat ve IP adresinizle {quote.firm} tarafından kaydedilir.</p>
        </form>
      ) : (
        <p className="rf-panel text-sm text-muted-foreground">Bu teklif şu an karar beklemiyor.</p>
      )}
    </main>
  );
}
