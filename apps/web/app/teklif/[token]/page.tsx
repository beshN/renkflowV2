"use client";
import { use, useCallback, useEffect, useState } from "react";
import { BadgeCheck, CalendarClock, FileText, XCircle } from "lucide-react";
import { ProductDrawing } from "@/components/drawing/ProductDrawing";
import { ColorChip } from "@/components/colors/ColorSwatch";
import { Skeleton, StatusChip } from "@/components/kit";
import { formatCurrency } from "@/lib/utils";
import Image from 'next/image';
import { StandardTerms } from '@/components/sales/StandardTerms';
import { standardTermsFor } from '@/lib/features/sales/standard-terms';
import { ProductDialog } from '@/components/features/product-3d/ProductDialog';
import type { ProductVisualization } from '@/lib/features/product-3d/catalog';
import type { AwningConfiguration } from '@/lib/features/awning/configuration';

import { PublicLanguageSwitch } from "@/components/shared/PublicLanguageSwitch";
import tr from "@/lib/i18n/locales/tr.json";
import en from "@/lib/i18n/locales/en.json";
import { usePublicLocale } from "@/lib/i18n/public-locale";

type Item = { productVisualization?:ProductVisualization|null;awningConfiguration?:AwningConfiguration|null;awningPreview?:string|null; productName: string; description: string | null; quantity: number; unitPrice: number; discountPercent: number; totalPrice: number; color: string | null; widthMm: number | null; heightMm: number | null; family: string | null; parameters: { widthMm: number | null; projectionMm: number | null; mountingHeightMm: number | null } | null };
type Quote = {
  firm: string; quotationNumber: string; revision: number; customerName: string; status: string; decidable: boolean; decidedAt: string | null; decidedBy: string | null;
  validUntil: string | null; currency: string; vatPercent: number; subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number; notes: string | null; terms: string | null; items: Item[];
};

/** The customer's own quote behind an approval link, with one decision: approve or reject, with their name. */
export default function QuoteApproval({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { token } = use(params);
  const { lang } = use(searchParams);
  const { locale, changeLanguage } = usePublicLocale({ tr: tr.quote.title, en: en.quote.title }, lang);
  const messages = (locale === "en" ? en : tr).quote;
  const dateLocale = locale === "en" ? "en-GB" : "tr-TR";
  const languageSwitch = <PublicLanguageSwitch locale={locale} onChange={changeLanguage} label={messages.language} />;
  const [quote, setQuote] = useState<Quote>();
  const [error, setError] = useState<"" | "invalidLink" | "loadError" | "submitError" | "rateLimited" | "checkFields">("");
  const [notice, setNotice] = useState<"" | "alreadyDecided">("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/public/quotes/${token}`, { cache: "no-store" });
      if (!r.ok) { setError(r.status === 404 ? "invalidLink" : r.status === 429 ? "rateLimited" : "loadError"); return; }
      const body = await r.json();
      setQuote(body.data);
      setError("");
    } catch { setError("loadError"); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function decide(decision: "accept" | "reject") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/v1/public/quotes/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, name, note: note || undefined }) });
      // Services use 409 for an already recorded decision and other state conflicts.
      if (r.status === 409) { setNotice("alreadyDecided"); await load(); return; }
      if (!r.ok) { setError(r.status === 404 ? "invalidLink" : r.status === 429 ? "rateLimited" : r.status === 400 ? "checkFields" : "submitError"); return; }
      await load();
    } catch { setError("submitError"); }
    finally { setBusy(false); }
  }

  if (error && !quote)
    return <main className="grid min-h-screen place-items-center bg-background p-6">{languageSwitch}<p role="alert" className="rf-panel max-w-md text-center text-sm">{messages[error]}</p></main>;
  if (!quote)
    return <main className="mx-auto min-h-screen max-w-3xl space-y-4 bg-background p-4 pt-10" role="status">{languageSwitch}<h1 className="rf-page-title">{messages.title}</h1><span className="sr-only">{messages.loading}</span><Skeleton className="h-10 w-2/3" /><Skeleton className="h-48" /><Skeleton className="h-24" /></main>;

  const done = quote.status === "accepted" || quote.status === "rejected";
  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-6 bg-background p-4 pt-8 sm:p-8 sm:pt-12">
      {languageSwitch}
      {notice && <p role="status" className="rf-panel text-sm">{messages[notice]}</p>}
      {error && <p role="alert" className="rf-panel text-sm">{messages[error]}</p>}
      <header className="space-y-5 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="rf-eyebrow">{quote.firm}</p>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight"><FileText size={24} aria-hidden /> {messages.title}</h1>
          </div>
          <div className="text-sm sm:text-right">
            <p className="break-all font-medium">{quote.quotationNumber}</p>
            <p className="mt-1 text-xs text-muted-foreground">{messages.revision} {quote.revision} · {quote.currency}</p>
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div><p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{messages.customer}</p><p className="mt-1 break-words font-semibold">{quote.customerName}</p></div>
          {quote.validUntil && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground sm:mt-0"><CalendarClock size={14} aria-hidden /> {messages.validUntil.replace("{{date}}", new Date(quote.validUntil + "T00:00:00+03:00").toLocaleDateString(dateLocale, { timeZone: "Europe/Istanbul" }))}</p>}
        </div>
      </header>

      <h2 className="text-base font-semibold">{messages.scope} <span className="ml-2 text-xs font-normal text-muted-foreground">{messages.items.replace("{{count}}", String(quote.items.length))}</span></h2>
      <ul className="space-y-4">
        {quote.items.map((item, i) => (
          <li key={i} className="rf-panel space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold">{i + 1}. {item.productName}</h3>
                <p className="text-sm text-muted-foreground">
                  {messages.quantity.replace("{{quantity}}", String(item.quantity))}{item.widthMm ? ` · ${item.widthMm}${item.heightMm ? ` × ${item.heightMm}` : ""} mm` : ""}
                  {item.color ? <> · <ColorChip color={item.color} size={14} showName /></> : null}
                </p>
                {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
              </div>
              <p className="text-right text-sm tabular-nums">
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">{messages.lineTotal}</span>
                <span className="block font-semibold">{formatCurrency(item.totalPrice, quote.currency)}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{messages.unit} {formatCurrency(item.unitPrice, quote.currency)}</span>
                {item.discountPercent > 0 && <span className="text-xs text-muted-foreground">{messages.discounted.replace("{{percent}}", String(item.discountPercent))}</span>}
              </p>
            </div>
            {item.parameters && <ProductDrawing family={item.family ?? "pergola"} widthMm={item.parameters.widthMm} projectionMm={item.parameters.projectionMm} heightMm={item.parameters.mountingHeightMm} color={item.color} className="h-auto max-h-56 w-full" />}
            {(item.productVisualization?.image||item.awningPreview)&&<Image src={item.productVisualization?.image||item.awningPreview!} alt={messages.view3d.replace("{{product}}", () => item.productName)} width={900} height={600} unoptimized className="max-h-64 w-full rounded-md bg-[#eceeeb] object-contain"/>}
            {(item.productVisualization||item.awningConfiguration)&&<ProductDialog visualization={item.productVisualization} awningConfiguration={item.awningConfiguration} previewImage={item.awningPreview} readOnly label={messages.open3d}/>}
          </li>
        ))}
      </ul>

      <section className="rf-panel space-y-1.5 text-sm tabular-nums" aria-label={messages.total}>
        <h2 className="mb-4 text-base font-semibold">{messages.quoteTotal}</h2>
        <p className="flex justify-between"><span>{messages.subtotal}</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></p>
        {quote.discountAmount > 0 && <p className="flex justify-between"><span>{messages.discount}</span><span>−{formatCurrency(quote.discountAmount, quote.currency)}</span></p>}
        <p className="flex justify-between text-muted-foreground"><span>{messages.vat.replace("{{percent}}", String(quote.vatPercent))}</span><span>{formatCurrency(quote.taxAmount, quote.currency)}</span></p>
        <p className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>{messages.grandTotal}</span><span>{formatCurrency(quote.totalAmount, quote.currency)}</span></p>
      </section>

      {(quote.notes || quote.terms) && (
        <section className="rf-panel space-y-2 text-sm">
          {quote.notes && <div><h2 className="mb-2 font-semibold">{messages.notes}</h2><p className="whitespace-pre-line">{quote.notes}</p></div>}
          {quote.terms && <div className={quote.notes ? "border-t border-border pt-4" : undefined}><h2 className="mb-2 font-semibold">{messages.terms}</h2><p className="whitespace-pre-line text-muted-foreground">{quote.terms}</p></div>}
        </section>
      )}

      {standardTermsFor(quote.firm) && (
        <details className="rf-panel text-sm">
          <summary className="cursor-pointer font-semibold">{messages.standardTerms}</summary>
          <div lang="tr" className="mt-4"><StandardTerms firmName={quote.firm} variant="plain" /></div>
        </details>
      )}

      {done ? (
        <section className="rf-panel flex items-center gap-3" role="status">
          <StatusChip tone={quote.status === "accepted" ? "success" : "danger"} icon={quote.status === "accepted" ? BadgeCheck : XCircle} label={quote.status === "accepted" ? messages.approved : messages.rejected} />
          <span className="text-sm">{quote.decidedBy}{quote.decidedAt ? ` · ${new Date(quote.decidedAt).toLocaleString(dateLocale, { timeZone: "Europe/Istanbul" })}` : ""}</span>
        </section>
      ) : quote.decidable ? (
        <form className="rf-panel space-y-3" onSubmit={(e) => { e.preventDefault(); void decide("accept"); }}>
          <h2 className="text-base font-semibold">{messages.review}</h2>
          <p className="text-sm text-muted-foreground">{messages.declaration}</p>
          {locale === "en" && <div lang="tr" className="text-sm"><p>{tr.quote.approve}</p><p>{tr.quote.declaration}</p><p lang="en" className="text-xs text-muted-foreground">{messages.binding}</p></div>}
          <label className="block text-sm">{messages.name}
            <input required minLength={2} maxLength={120} autoComplete="name" className="rf-input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">{messages.note}
            <textarea maxLength={1000} className="rf-input mt-1 min-h-16 w-full" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy || name.trim().length < 2} className="rf-primary-button"><BadgeCheck size={15} /> {messages.approve}</button>
            <button type="button" disabled={busy || name.trim().length < 2} className="rf-input" onClick={() => void decide("reject")}>{messages.reject}</button>
          </div>
          <p className="text-[11px] text-muted-foreground">{messages.record.replace("{{firm}}", () => quote.firm)}</p>
        </form>
      ) : (
        <p className="rf-panel text-sm text-muted-foreground">{messages.notDecidable}</p>
      )}
    </main>
  );
}
