"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, Box } from "lucide-react";
import { submitQuote } from "@/lib/features/fair/client";
import { itemSize, newToken, type DesignItem } from "@/lib/features/fair/design";
import { fairText, privacyNotice, productName, type Locale, type PrivacyController } from "@/lib/features/fair/i18n";

export type QuoteResult = { number: string | null; emailStatus: string; email: string; designVersion: number | null };

/** Contact details for a quote; only name and e-mail are required. Marketing consent is separate and off. */
export function QuoteForm({
  locale,
  controller,
  token,
  fairCode,
  items,
  prepare,
  onConflict,
  onBack,
  onDone,
}: {
  locale: Locale;
  controller: PrivacyController;
  token: string;
  fairCode: string | null;
  items: DesignItem[];
  /** Waits for pending saves and returns the design version the request is for. */
  prepare: () => Promise<number | null>;
  onConflict: () => void;
  onBack: () => void;
  onDone: (r: QuoteResult) => void;
}) {
  const f = fairText(locale);
  const [form, setForm] = useState({ contactName: "", email: "", phone: "", companyName: "", location: "", note: "", website: "" });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  // One id per filled-in form: pressing send again after a dropped connection returns the same request.
  const [submissionId] = useState(newToken);
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((s) => ({ ...s, [key]: e.target.value })) });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) {
      setError(f.offlineSend);
      return;
    }
    setBusy(true);
    setError("");
    setConflict(false);
    const designVersion = await prepare();
    const result = await submitQuote({ token, submissionId, designVersion, fairCode, locale, items, ...form, privacyAccepted, marketingConsent });
    setBusy(false);
    if (!result.ok) {
      if (result.status === 409) setConflict(true);
      setError(result.status === 409 ? f.designChanged : result.status === 400 ? f.invalid : result.status === 0 ? f.offlineSend : f.sendFailed);
      return;
    }
    onDone({ number: result.data.number, emailStatus: result.data.emailStatus, email: form.email, designVersion: result.data.designVersion ?? null });
  }

  const label = (text: string, required = false) => (
    <span>
      {text}
      {required && <span aria-hidden className="text-primary"> *</span>}
    </span>
  );
  return (
    <section aria-labelledby="quote-title" className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" aria-label={f.back} className="fx-btn fx-btn-quiet !min-h-12 w-12 shrink-0 !px-0" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 id="quote-title" className="fx-display text-3xl">{f.quoteTitle}</h1>
          <p className="text-sm text-muted-foreground">{f.quoteHint}</p>
        </div>
      </div>
      <div className="fx-sheet p-4">
        <p className="fx-note">{f.quoteFor(items.length)}</p>
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <span className="relative flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                {item.image ? <Image src={item.image} alt="" fill unoptimized sizes="64px" className="object-cover" /> : <Box size={18} aria-hidden />}
              </span>
              <span className="min-w-0 text-sm">
                <span className="block truncate font-medium">{item.quantity > 1 ? `${item.quantity} × ` : ""}{productName(locale, item.kind)}</span>
                <span className="block tabular-nums text-muted-foreground">{itemSize(item)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={send} className="fx-sheet space-y-4 p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">{f.requiredHint}</p>
        <label className="fx-field">{label(f.fields.contactName, true)}<input className="rf-input mt-1.5 min-h-12 w-full text-base" required minLength={2} maxLength={200} autoComplete="name" {...field("contactName")} /></label>
        <label className="fx-field">{label(f.fields.email, true)}<input className="rf-input mt-1.5 min-h-12 w-full text-base" required type="email" inputMode="email" autoComplete="email" maxLength={200} {...field("email")} /></label>
        <label className="fx-field">{label(f.fields.phone)}<input className="rf-input mt-1.5 min-h-12 w-full text-base" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} {...field("phone")} /></label>
        <label className="fx-field">{label(f.fields.companyName)}<input className="rf-input mt-1.5 min-h-12 w-full text-base" autoComplete="organization" maxLength={200} {...field("companyName")} /></label>
        <label className="fx-field">{label(f.fields.location)}<input className="rf-input mt-1.5 min-h-12 w-full text-base" autoComplete="country-name" maxLength={200} {...field("location")} /></label>
        <label className="fx-field">{label(f.fields.note)}<textarea className="rf-input mt-1.5 min-h-24 w-full text-base" maxLength={2000} placeholder={f.notePlaceholder} {...field("note")} /></label>
        {/* Honeypot: hidden from people and assistive technology. */}
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0 opacity-0" {...field("website")} />
        <details className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">{f.privacyTitle}</summary>
          <div className="mt-2 space-y-2">{privacyNotice(locale, controller).map((p) => <p key={p.slice(0, 32)}>{p}</p>)}</div>
        </details>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
          <span>{f.privacyAck}<span aria-hidden className="text-primary">{"\u00a0*"}</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />
          <span>{f.marketing}</span>
        </label>
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <span className="flex-1">{error}</span>
            {conflict && <button type="button" className="min-h-10 rounded-lg border border-rose-300 bg-white px-3 font-medium" onClick={onConflict}>{f.reloadDesign}</button>}
          </div>
        )}
        <button type="submit" disabled={busy} className="fx-btn w-full !min-h-12 text-base">{busy ? f.sending : f.send}</button>
      </form>
    </section>
  );
}
