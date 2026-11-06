"use client";
import { use, useEffect, useState } from "react";
import { BadgeCheck, CalendarCheck2, Factory, FileText, MessageCircle, PackageCheck, Scissors, Truck, Wrench } from "lucide-react";
import { ProductDialog } from "@/components/features/product-3d/ProductDialog";
import { ProductDrawing } from "@/components/drawing/ProductDrawing";
import { ColorChip } from "@/components/colors/ColorSwatch";
import { ProgressRing, Skeleton, Timeline } from "@/components/kit";
import { LIFECYCLE, lifecycleIndex } from "@/lib/features/orders/lifecycle";
import { normalizeOrderStatus } from "@/lib/features/orders/workspace";
import tr from "@/lib/i18n/locales/tr.json";
import en from "@/lib/i18n/locales/en.json";
import { cn } from "@/lib/utils";

const ICONS = [FileText, BadgeCheck, Factory, Scissors, Wrench, Truck];

export default function Tracking({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { token } = use(params);
  const { lang } = use(searchParams);
  // Keep this public route independent of the global detector and its storage cache.
  const [locale, setLocale] = useState<"tr" | "en">(lang === "en" ? "en" : "tr");
  const messages = (locale === "en" ? en : tr).track;
  useEffect(() => {
    const selectLanguage = () => {
      const requested = new URLSearchParams(window.location.search).get("lang");
      setLocale(requested === "en" || requested === "tr" ? requested : navigator.language?.toLowerCase().startsWith("en") ? "en" : "tr");
    };
    selectLanguage();
    window.addEventListener("popstate", selectLanguage);
    return () => window.removeEventListener("popstate", selectLanguage);
  }, []);
  useEffect(() => {
    const previous = document.documentElement.lang;
    const previousTitle = document.title;
    document.documentElement.lang = locale;
    document.title = `${messages.title} | RenkFlow`;
    return () => { document.documentElement.lang = previous; document.title = previousTitle; };
  }, [locale, messages.title]);
  const changeLanguage = (language: "tr" | "en") => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", language);
    window.history.pushState(null, "", url);
    setLocale(language);
  };
  const [data, setData] = useState<any>();
  const [error, setError] = useState<"" | "invalidLink" | "loadError" | "rateLimited">("");
  useEffect(() => {
    const c = new AbortController();
    setData(undefined);
    setError("");
    async function load() {
      try {
        const r = await fetch(`/api/v1/tracking/${token}`, { signal: c.signal, cache: "no-store" });
        if (c.signal.aborted) return;
        if (r.status === 429) { setError("rateLimited"); return; }
        const body = await r.json();
        if (c.signal.aborted) return;
        if (!r.ok) { setError(r.status === 404 ? "invalidLink" : "loadError"); return; }
        setError("");
        setData(body.data);
      } catch {
        if (!c.signal.aborted) setError("loadError");
      }
    }
    void load();
    const timer = setInterval(load, 20000);
    return () => { c.abort(); clearInterval(timer); };
  }, [token]);

  const status = data ? normalizeOrderStatus(data.status) : "";
  const at = data ? (status === "completed" ? LIFECYCLE.length : lifecycleIndex(status)) : -1;
  const share = () => {
    const sentence = messages.sentences[status as keyof typeof messages.sentences] ?? "";
    const text = messages.shareText.replace("{{orderNumber}}", () => data.orderNumber).replace("{{sentence}}", () => sentence).replace("{{url}}", () => window.location.href);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-4 pt-10 sm:p-6 sm:pt-12">
      <div className="flex items-center justify-between gap-3">
        <p className="rf-eyebrow">{messages.eyebrow}</p>
        <div className="flex gap-2 text-xs" role="group" aria-label={messages.language}>
          {(["tr", "en"] as const).map((language) => <button key={language} type="button" lang={language} className={cn(locale === language ? "rf-primary-button" : "rf-secondary-button", "h-8 !px-2 !py-1 !text-xs")} aria-pressed={locale === language} onClick={() => changeLanguage(language)}>{language.toUpperCase()}</button>)}
        </div>
      </div>
      {error && <p role="alert" className="rf-alert">{error === "rateLimited"
        ? locale === "en" ? "Too many attempts. Please try again shortly." : "Çok sık denendi, biraz sonra tekrar deneyin."
        : messages[error]}</p>}
      {!data ? !error && (
        <div className="space-y-4" role="status"><span className="sr-only">{messages.loading}</span><Skeleton className="h-10 w-48" /><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /></div>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-mono text-3xl font-semibold">{data.orderNumber}</h1>
              <p className="mt-2 text-xl text-primary">{messages.sentences[status as keyof typeof messages.sentences] ?? messages.fallback}</p>
            </div>
            <button type="button" onClick={share} className="rf-secondary-button h-10 gap-2 px-3 text-sm"><MessageCircle size={16} aria-hidden /> {messages.share}</button>
          </header>

          {at >= 0 && (
            <ol className="flex items-start" aria-label={messages.stages}>
              {LIFECYCLE.map((step, i) => {
                const Icon = ICONS[i];
                const done = i < at, current = i === at;
                return (
                  <li key={step.key} className="flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={current ? "step" : undefined}>
                    <span className="relative flex w-full items-center">
                      <span aria-hidden className={cn("h-1 flex-1", i === 0 ? "bg-transparent" : done || current ? "bg-primary" : "bg-border")} />
                      <span className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-full border-2",
                        done ? "border-primary bg-primary text-primary-foreground" : current ? "border-primary bg-background text-primary" : "border-border bg-background text-muted-foreground")}>
                        {current && <span aria-hidden className="absolute inset-0 animate-ping rounded-full border-2 border-primary/40 motion-reduce:hidden" />}
                        <Icon size={18} aria-hidden />
                      </span>
                      <span aria-hidden className={cn("h-1 flex-1", i === LIFECYCLE.length - 1 ? "bg-transparent" : done ? "bg-primary" : "bg-border")} />
                    </span>
                    <span className={cn("text-[11px] sm:text-xs", current ? "font-semibold" : "text-muted-foreground")}>{messages.steps[step.key]}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {data.deliveryDate && (
            <p className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
              <CalendarCheck2 size={18} aria-hidden className="text-primary" />
              <span className="text-muted-foreground">{messages.estimatedDelivery}</span>
              <strong className="ml-auto tabular-nums">{new Date(data.deliveryDate + "T00:00:00+03:00").toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", weekday: "long" })}</strong>
            </p>
          )}

          {data.items.map((item: any) => {
            const jobs = data.jobs.filter((j: any) => j.order_item_id === item.id);
            const planned = jobs.reduce((n: number, j: any) => n + Number(j.planned_qty || 0), 0);
            const produced = jobs.reduce((n: number, j: any) => n + Number(j.produced_qty || 0), 0);
            return (
              <section key={item.id} className="rf-panel space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-medium">{item.product_name}</h2>
                    <p className="text-sm text-muted-foreground">{messages.quantity.replace("{{quantity}}", String(item.quantity))}{item.color ? <> · <ColorChip color={item.color} size={14} /></> : null}</p>
                  </div>
                  {planned > 0 && <ProgressRing value={produced} max={planned} label={messages.produced.replace("{{produced}}", String(produced)).replace("{{planned}}", String(planned))} center={`${produced}/${planned}`} />}
                </div>
                {item.parameters && <ProductDrawing family={item.family ?? "pergola"} widthMm={item.parameters.widthMm} projectionMm={item.parameters.projectionMm} heightMm={item.parameters.mountingHeightMm} color={item.color} className="h-auto max-h-64 w-full" />}
                {(item.awning_configuration || item.product_visualization) && <ProductDialog visualization={item.product_visualization} awningConfiguration={item.awning_configuration} previewImage={item.awning_preview} readOnly label={messages.open3d} />}
              </section>
            );
          })}

          {data.shipments.length > 0 && (
            <section className="rf-panel">
              <h2 className="mb-4 flex items-center gap-2 font-medium"><Truck size={16} aria-hidden /> {messages.shipments}</h2>
              <Timeline items={data.shipments.map((s: any, i: number) => ({
                id: String(i),
                icon: s.status === "delivered" ? PackageCheck : Truck,
                tone: s.status === "delivered" ? "in" : "neutral",
                title: `${messages.quantity.replace("{{quantity}}", String(s.quantity))} · ${s.status === "delivered" ? messages.delivered : messages.inTransit}`,
                when: new Date(s.created_at).toLocaleDateString(locale === "en" ? "en-GB" : "tr-TR", { timeZone: "Europe/Istanbul" }),
                detail: [s.carrier, s.tracking_number].filter(Boolean).join(" "),
              }))} />
            </section>
          )}
        </>
      )}
    </main>
  );
}
