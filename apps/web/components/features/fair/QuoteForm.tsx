"use client";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { submitQuote } from "@/lib/features/fair/client";
import type { DesignItem } from "@/lib/features/fair/design";
import { fairText, privacyNotice, type Locale } from "@/lib/features/fair/i18n";

export type QuoteResult = { number: string | null; emailStatus: string; email: string };

/** Contact details for a quote; only name and e-mail are required. Marketing consent is separate and off. */
export function QuoteForm({
  locale,
  firm,
  token,
  fairCode,
  items,
  onBack,
  onDone,
}: {
  locale: Locale;
  firm: string;
  token: string;
  fairCode: string | null;
  items: DesignItem[];
  onBack: () => void;
  onDone: (r: QuoteResult) => void;
}) {
  const f = fairText(locale);
  const [form, setForm] = useState({ contactName: "", email: "", phone: "", companyName: "", location: "", note: "", website: "" });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((s) => ({ ...s, [key]: e.target.value })) });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) {
      setError(f.offlineSend);
      return;
    }
    setBusy(true);
    setError("");
    const result = await submitQuote({ token, fairCode, locale, items, ...form, privacyAccepted, marketingConsent });
    setBusy(false);
    if (!result.ok) {
      setError(result.status === 400 ? f.invalid : result.status === 0 ? f.offlineSend : f.sendFailed);
      return;
    }
    onDone({ number: result.data.number, emailStatus: result.data.emailStatus, email: form.email });
  }

  const label = (text: string, required = false) => (
    <span>
      {text}
      {required && <span className="text-muted-foreground"> ({f.required})</span>}
    </span>
  );
  return (
    <section aria-labelledby="quote-title" className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" aria-label={f.back} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 id="quote-title" className="font-display text-xl font-semibold">{f.quoteTitle}</h1>
          <p className="text-xs text-muted-foreground">{f.quoteHint}</p>
        </div>
      </div>
      <form onSubmit={send} className="space-y-3 rounded-lg border border-border bg-card p-4">
        <label className="block text-sm">{label(f.fields.contactName, true)}<input className="rf-input mt-1 w-full" required minLength={2} maxLength={200} autoComplete="name" {...field("contactName")} /></label>
        <label className="block text-sm">{label(f.fields.email, true)}<input className="rf-input mt-1 w-full" required type="email" inputMode="email" autoComplete="email" maxLength={200} {...field("email")} /></label>
        <label className="block text-sm">{label(f.fields.phone)}<input className="rf-input mt-1 w-full" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} {...field("phone")} /></label>
        <label className="block text-sm">{label(f.fields.companyName)}<input className="rf-input mt-1 w-full" autoComplete="organization" maxLength={200} {...field("companyName")} /></label>
        <label className="block text-sm">{label(f.fields.location)}<input className="rf-input mt-1 w-full" autoComplete="country-name" maxLength={200} {...field("location")} /></label>
        <label className="block text-sm">{label(f.fields.note)}<textarea className="rf-input mt-1 min-h-20 w-full" maxLength={2000} placeholder={f.notePlaceholder} {...field("note")} /></label>
        {/* Honeypot: hidden from people and assistive technology. */}
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0 opacity-0" {...field("website")} />
        <details className="rounded border border-border p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">{f.privacyTitle}</summary>
          <div className="mt-2 space-y-2">{privacyNotice(locale, firm).map((p) => <p key={p.slice(0, 32)}>{p}</p>)}</div>
        </details>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
          <span>{f.privacyAck} <span className="text-muted-foreground">({f.required})</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />
          <span>{f.marketing}</span>
        </label>
        {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        <button type="submit" disabled={busy} className="rf-primary-button min-h-12 w-full justify-center text-base">{busy ? f.sending : f.send}</button>
      </form>
    </section>
  );
}
