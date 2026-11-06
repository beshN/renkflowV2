"use client";
import { use, useCallback, useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, Circle, PackageX } from "lucide-react";
import { Skeleton } from "@/components/kit";

import tr from "@/lib/i18n/locales/tr.json";
import en from "@/lib/i18n/locales/en.json";
import { usePublicLocale } from "@/lib/i18n/public-locale";

type SignOff = {
  firm: string; number: string; orderNumber: string; customerName: string; date: string | null; status: string;
  items: Array<{ productName: string; quantity: number; widthMm: number | null; heightMm: number | null; color: string | null }>;
  checklist: Array<{ title: string; done: boolean }>;
  issues: Array<{ kind: string; text: string }>;
  signed: { name: string; at: string } | null;
};

/** The customer's delivery sign-off: what was installed, and their name to accept it. No prices. */
export default function DeliverySignOff({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { locale, changeLanguage } = usePublicLocale({ tr: tr.signoff.title, en: en.signoff.title });
  const messages = (locale === "en" ? en : tr).signoff;
  const dateLocale = locale === "en" ? "en-GB" : "tr-TR";
  const languageSwitch = <div className="flex gap-2 text-xs" role="group" aria-label={messages.language}>
    {(["tr", "en"] as const).map((language) => <button key={language} type="button" lang={language} aria-pressed={locale === language} onClick={() => changeLanguage(language)}>{language.toUpperCase()}</button>)}
  </div>;
  const [data, setData] = useState<SignOff>();
  const [error, setError] = useState<"" | "invalidLink" | "loadError" | "submitError">("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/public/signoff/${token}`, { cache: "no-store" });
      if (!r.ok) { setError(r.status === 404 ? "invalidLink" : "loadError"); return; }
      setData(await r.json());
      setError("");
    } catch { setError("loadError"); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/v1/public/signoff/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, accept: true, note: note || null }) });
      if (!r.ok) { setError(r.status === 404 ? "invalidLink" : "submitError"); return; }
      await load();
    } catch { setError("submitError"); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-background p-4 text-foreground md:p-8">
      {languageSwitch}
      {error && !data && <p role="alert" className="rf-panel p-4 text-sm">{messages[error]}</p>}
      {!data && !error && <div role="status"><span className="sr-only">{messages.loading}</span><Skeleton className="h-64" /></div>}
      {data && (
        <>
          <header className="space-y-1 border-b border-border pb-3">
            <p className="rf-eyebrow">{data.firm}</p>
            <h1 className="rf-page-title">{messages.title}</h1>
            <p className="text-sm">{data.customerName} · {messages.order} {data.orderNumber} · {messages.installation} {data.number}{data.date ? ` · ${new Date(/^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date + "T00:00:00+03:00" : data.date).toLocaleDateString(dateLocale, { timeZone: "Europe/Istanbul" })}` : ""}</p>
          </header>
          <section className="rf-panel space-y-2 p-4" aria-label={messages.work}>
            <h2 className="text-sm font-semibold">{messages.products}</h2>
            <ul className="space-y-1 text-sm">
              {data.items.map((i, n) => (
                <li key={n}>{i.quantity} × {i.productName}{i.widthMm ? ` · ${i.widthMm}${i.heightMm ? ` × ${i.heightMm}` : ""} mm` : ""}{i.color ? ` · ${i.color}` : ""}</li>
              ))}
            </ul>
            {data.checklist.length > 0 && (
              <>
                <h2 className="pt-2 text-sm font-semibold">{messages.checklist}</h2>
                <ul className="space-y-1 text-sm">
                  {data.checklist.map((c, n) => <li key={n} className="flex items-center gap-2">{c.done ? <CheckCircle2 size={16} className="text-emerald-600" aria-label={messages.done} /> : <Circle size={16} className="text-muted-foreground" aria-label={messages.notDone} />}{c.title}</li>)}
                </ul>
              </>
            )}
            {data.issues.length > 0 && (
              <>
                <h2 className="flex items-center gap-1 pt-2 text-sm font-semibold"><PackageX size={16} aria-hidden /> {messages.issues}</h2>
                <ul className="list-disc pl-5 text-sm">{data.issues.map((i, n) => <li key={n}>{i.kind === "missing" ? messages.missing : messages.damage}: {i.text}</li>)}</ul>
              </>
            )}
          </section>
          {data.signed ? (
            <p role="status" className="rf-panel flex items-center gap-2 p-4 text-sm"><BadgeCheck size={18} className="text-emerald-600" aria-hidden /> {messages.received.replace("{{name}}", () => data.signed!.name).replace("{{date}}", new Intl.DateTimeFormat(dateLocale, { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.signed.at)))}</p>
          ) : (
            <form onSubmit={sign} className="rf-panel space-y-3 p-4" aria-label={messages.signature}>
              {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{messages[error]}</p>}
              <label className="block text-sm">{messages.name}<input className="rf-input mt-1 w-full" required minLength={3} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
              <label className="block text-sm">{messages.note}<textarea className="rf-input mt-1 w-full" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" required checked={accept} onChange={(e) => setAccept(e.target.checked)} /> {messages.declaration}</label>
              {locale === "en" && <div lang="tr" className="text-sm"><p>{tr.signoff.declaration}</p><p>{tr.signoff.approve}</p><p lang="en" className="text-xs text-muted-foreground">{messages.binding}</p></div>}
              <button type="submit" className="rf-primary-button w-full text-sm sm:w-auto" disabled={busy || !accept}>{messages.approve}</button>
              <p className="text-xs text-muted-foreground">{messages.record}</p>
            </form>
          )}
        </>
      )}
    </main>
  );
}
