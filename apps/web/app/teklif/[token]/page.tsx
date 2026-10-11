"use client";
import { use, useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, FileText, XCircle } from "lucide-react";
import { ProductDrawing } from "@/components/drawing/ProductDrawing";
import { ColorChip } from "@/components/colors/ColorSwatch";
import { Skeleton, StatusChip } from "@/components/kit";
import { formatCurrency } from "@/lib/utils";

type Item = { productName: string; description: string | null; quantity: number; unitPrice: number; discountPercent: number; totalPrice: number; color: string | null; widthMm: number | null; heightMm: number | null; family: string | null; parameters: { widthMm: number | null; projectionMm: number | null; mountingHeightMm: number | null } | null };
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
    <main className="mx-auto min-h-screen max-w-3xl space-y-5 bg-background p-4 pt-8 sm:p-6 sm:pt-12">
      <header className="space-y-1">
        <p className="rf-eyebrow">{quote.firm}</p>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileText size={22} aria-hidden /> {quote.quotationNumber}
          <span className="text-sm font-normal text-muted-foreground">rev. {quote.revision}</span>
        </h1>
        <p className="text-sm text-muted-foreground">{quote.customerName}</p>
        {quote.validUntil && <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock size={13} aria-hidden /> {new Date(quote.validUntil + "T00:00:00").toLocaleDateString("tr-TR")} tarihine kadar geçerli</p>}
      </header>

      <ul className="space-y-3">
        {quote.items.map((item, i) => (
          <li key={i} className="rf-panel space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{item.productName}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} adet{item.widthMm ? ` · ${item.widthMm}${item.heightMm ? ` × ${item.heightMm}` : ""} mm` : ""}
                  {item.color ? <> · <ColorChip color={item.color} size={14} showName /></> : null}
                </p>
                {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
              </div>
              <p className="text-right text-sm tabular-nums">
                <span className="block font-semibold">{formatCurrency(item.totalPrice, quote.currency)}</span>
                {item.discountPercent > 0 && <span className="text-xs text-muted-foreground">%{item.discountPercent} indirimli</span>}
              </p>
            </div>
            {item.parameters && <ProductDrawing family={item.family ?? "pergola"} widthMm={item.parameters.widthMm} projectionMm={item.parameters.projectionMm} heightMm={item.parameters.mountingHeightMm} color={item.color} className="h-auto max-h-56 w-full" />}
          </li>
        ))}
      </ul>

      <section className="rf-panel space-y-1.5 text-sm tabular-nums" aria-label="Toplam">
        <p className="flex justify-between"><span>Ara toplam</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></p>
        {quote.discountAmount > 0 && <p className="flex justify-between"><span>İndirim</span><span>−{formatCurrency(quote.discountAmount, quote.currency)}</span></p>}
        <p className="flex justify-between text-muted-foreground"><span>KDV %{quote.vatPercent}</span><span>{formatCurrency(quote.taxAmount, quote.currency)}</span></p>
        <p className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Genel toplam</span><span>{formatCurrency(quote.totalAmount, quote.currency)}</span></p>
      </section>

      {(quote.notes || quote.terms) && (
        <section className="rf-panel space-y-2 text-sm">
          {quote.notes && <p className="whitespace-pre-line">{quote.notes}</p>}
          {quote.terms && <p className="whitespace-pre-line text-muted-foreground">{quote.terms}</p>}
        </section>
      )}

      {done ? (
        <section className="rf-panel flex items-center gap-3" role="status">
          <StatusChip tone={quote.status === "accepted" ? "success" : "danger"} icon={quote.status === "accepted" ? BadgeCheck : XCircle} label={quote.status === "accepted" ? "Onaylandı" : "Reddedildi"} />
          <span className="text-sm">{quote.decidedBy}{quote.decidedAt ? ` · ${new Date(quote.decidedAt).toLocaleString("tr-TR")}` : ""}</span>
        </section>
      ) : quote.decidable ? (
        <form className="rf-panel space-y-3" onSubmit={(e) => { e.preventDefault(); void decide("accept"); }}>
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
