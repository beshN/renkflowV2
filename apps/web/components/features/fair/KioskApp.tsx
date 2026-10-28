"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Check, Expand, Plus, Smartphone, WifiOff } from "lucide-react";
import { configuratorBase, createDesign } from "@/lib/features/fair/client";
import { MAX_ITEMS, newItem, newToken, type DesignItem } from "@/lib/features/fair/design";
import { fairText, type Locale } from "@/lib/features/fair/i18n";
import { isQueued, pendingCount, queueDesign, syncOutbox } from "@/lib/features/fair/outbox";
import type { FairKind } from "@/lib/features/fair/products";
import { encodeDesign } from "@/lib/features/fair/transfer";
import { useMarkStandaloneScreen } from "@/lib/shared/hooks/useWorkspacePresence";
import { AttractScreen } from "./AttractScreen";
import { BrandLogo } from "./BrandLogo";
import { ItemEditor } from "./ItemEditor";
import { ItemList } from "./ItemList";
import { LanguageSwitch } from "./LanguageSwitch";
import { ProductPicker } from "./ProductPicker";
import { registerConfiguratorWorker } from "./offline";
import { useFairLightTheme } from "./theme";

/** Inactivity (seconds) before "Are you still there?", the countdown after it, and the QR screen's own limit. */
export const KIOSK_TIMING = { idlePrompt: 90, promptCountdown: 20, qrScreen: 180 };

type View = "welcome" | "pick" | "edit" | "list" | "qr";
/** Where the QR's design is: on the server, in this kiosk's queue, or (storage failed, offline) only in the QR code. */
type QrState = { image: string; token: string; stored: "server" | "queued" | "qr-only" };
type Fair = { code: string; name: string; defaultLocale: Locale; campaign: string | null };

/**
 * Fair kiosk: large touch screen, no personal data. Visitors configure one or more products and
 * take them to their phone with a QR code. The visitor's session lives only in memory; designs
 * waiting for the server live in the IndexedDB outbox, which a reset never touches.
 */
export function KioskApp({ fair, release }: { fair: Fair; release: string }) {
  useMarkStandaloneScreen();
  useFairLightTheme();
  const [locale, setLocale] = useState<Locale>(fair.defaultLocale);
  const [view, setView] = useState<View>("welcome");
  const [items, setItems] = useState<DesignItem[]>([]);
  const [editing, setEditing] = useState<{ item: DesignItem; isNew: boolean } | null>(null);
  const [qr, setQr] = useState<QrState | null>(null);
  const [idle, setIdle] = useState(0);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const lastActivity = useRef(Date.now());
  const qrShown = useRef<QrState | null>(null);
  qrShown.current = qr;
  const f = fairText(locale);

  const reset = useCallback(() => {
    setItems([]);
    setEditing(null);
    setQr(null);
    setLocale(fair.defaultLocale);
    setView("welcome");
    lastActivity.current = Date.now();
    setIdle(0);
  }, [fair.defaultLocale]);

  // Kiosk scale and touch behaviour, only while this screen is mounted.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("rf-kiosk");
    const noMenu = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", noMenu);
    return () => {
      html.classList.remove("rf-kiosk");
      document.removeEventListener("contextmenu", noMenu);
    };
  }, []);

  // Inactivity: any touch, key or wheel counts as activity.
  useEffect(() => {
    const touch = () => {
      lastActivity.current = Date.now();
      setIdle(0);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(() => setIdle(Math.floor((Date.now() - lastActivity.current) / 1000)), 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
    };
  }, []);
  const limit = view === "qr" ? KIOSK_TIMING.qrScreen : KIOSK_TIMING.idlePrompt + KIOSK_TIMING.promptCountdown;
  useEffect(() => {
    if (view !== "welcome" && idle >= limit) reset();
  }, [idle, limit, view, reset]);
  const prompting = view !== "welcome" && view !== "qr" && idle >= KIOSK_TIMING.idlePrompt;

  // Offline support: cache the app and 3D code on this device, and keep sending queued designs.
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const sync = () =>
      void syncOutbox().then(async (left) => {
        setPending(left);
        // The QR on screen may be the design that just reached the server.
        const shown = qrShown.current;
        if (shown?.stored === "queued" && !(await isQueued(shown.token))) setQr((current) => (current?.token === shown.token ? { ...current, stored: "server" } : current));
      });
    update();
    void pendingCount().then(setPending);
    sync();
    void registerConfiguratorWorker(release);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("online", sync);
    const timer = window.setInterval(sync, 30_000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("online", sync);
      window.clearInterval(timer);
    };
  }, [release]);

  async function continueOnPhone() {
    if (!items.length) return;
    const token = newToken();
    const payload = { token, fairCode: fair.code, origin: "kiosk" as const, locale, items };
    // Queued first: the design survives a reset, a reload or a power cut until the server has it.
    // Without storage the design still travels in the QR code, so the visitor is never stuck here.
    const queued = await queueDesign(payload).then(() => true, () => false);
    const link = `${window.location.origin}${configuratorBase()}/c/${token}#d=${encodeDesign({ fairCode: fair.code, locale, items })}`;
    const image = await QRCode.toDataURL(link, { width: 720, margin: 2, errorCorrectionLevel: "L" });
    setQr({ image, token, stored: "queued" });
    setView("qr");
    let stored: QrState["stored"];
    if (queued) {
      const left = await syncOutbox();
      setPending(left);
      stored = (await isQueued(token)) ? "queued" : "server";
    } else {
      stored = (await createDesign(payload)).ok ? "server" : "qr-only";
    }
    setQr((current) => (current?.token === token ? { ...current, stored } : current));
  }

  function startItem(kind: FairKind) {
    setEditing({ item: newItem(kind), isNew: true });
    setView("edit");
  }

  return (
    <div className="rf-fair flex min-h-dvh select-none flex-col [touch-action:manipulation]">
      {/* Scales with the screen in either orientation: 18px on a 1920 × 1080 screen, landscape or portrait. */}
      <style>{`html.rf-kiosk{font-size:clamp(16px,calc(0.6vw + 0.6vh),26px)}`}</style>
      {/* The idle screen covers everything; what is under it must not take focus or reach screen readers. */}
      {view === "welcome" && (
        <AttractScreen locale={locale} onLocale={setLocale} campaign={locale === fair.defaultLocale ? fair.campaign : null} onStart={() => setView("pick")} onPick={startItem} />
      )}
      <header inert={view === "welcome"} className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <BrandLogo height={44} />
          <p className="truncate border-l border-border pl-4 text-sm text-muted-foreground">{fair.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {(!online || pending > 0) && (
            <span role="status" className="inline-flex items-center gap-1 rounded-md border border-amber-600/40 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">
              {!online && <><WifiOff size={14} aria-hidden /> {f.offlineBadge}</>}
              {pending > 0 && <span>{!online ? " · " : ""}{f.pendingSync(pending)}</span>}
            </span>
          )}
          <LanguageSwitch locale={locale} onChange={setLocale} large />
          <button type="button" aria-label={f.fullscreen} className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card" onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()).catch(() => {})}>
            <Expand size={18} />
          </button>
        </div>
      </header>

      <main inert={view === "welcome"} className="flex-1 px-6 py-5">
        {view === "pick" && <ProductPicker locale={locale} onPick={startItem} disabled={items.length >= MAX_ITEMS} kiosk />}

        {view === "edit" && editing && (
          <ItemEditor
            key={editing.item.id}
            locale={locale}
            item={editing.item}
            isNew={editing.isNew}
            kiosk
            onBack={() => setView(items.length ? "list" : "pick")}
            onSave={(item) => {
              setItems((current) => (editing.isNew ? [...current, item] : current.map((i) => (i.id === item.id ? item : i))));
              setEditing(null);
              setView("list");
            }}
          />
        )}

        {view === "list" && (
          <section aria-labelledby="kiosk-list" className="mx-auto max-w-5xl space-y-6 py-2">
            <h1 id="kiosk-list" className="font-display text-4xl font-semibold">{f.listTitle}</h1>
            <ItemList
              locale={locale}
              items={items}
              large
              onEdit={(item) => {
                setEditing({ item, isNew: false });
                setView("edit");
              }}
              onRemove={(item) => setItems((current) => current.filter((i) => i.id !== item.id))}
            />
            {!items.length && <p className="text-muted-foreground">{f.listEmpty}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={items.length >= MAX_ITEMS} className="inline-flex min-h-20 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card text-xl font-medium text-muted-foreground disabled:opacity-50" onClick={() => setView("pick")}>
                <Plus size={20} aria-hidden /> {f.addAnother}
              </button>
              <button type="button" disabled={!items.length} className="rf-fair-btn inline-flex min-h-20 justify-center gap-3 text-xl" onClick={() => void continueOnPhone()}>
                <Smartphone size={24} aria-hidden /> {f.continueOnPhone}
              </button>
            </div>
          </section>
        )}

        {view === "qr" && qr && (
          <section className="mx-auto grid max-w-6xl items-center gap-12 py-4 portrait:max-w-3xl portrait:py-10 landscape:lg:grid-cols-[auto_1fr]" aria-labelledby="qr-title">
            <div className="mx-auto rounded-3xl border border-border bg-white p-6 shadow-xl">
              <Image src={qr.image} alt={f.scanTitle} width={720} height={720} unoptimized style={{ width: "min(56vh, 80vw, 640px)", height: "auto" }} />
            </div>
            <div className="space-y-7">
              <div className="space-y-3">
                <h1 id="qr-title" className="font-display text-5xl font-semibold leading-tight">{f.scanTitle}</h1>
                <p className="text-xl text-muted-foreground">{f.scanHint}</p>
              </div>
              <ol className="space-y-3">
                {f.scanSteps.map((step, i) => (
                  <li key={step} className="flex items-center gap-4 text-xl">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-3">
                {items.map((item) => (
                  <span key={item.id} className="relative h-20 w-28 overflow-hidden rounded-lg border border-border bg-muted">
                    {item.image && <Image src={item.image} alt="" fill unoptimized sizes="112px" className="object-cover" />}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-5 border-t border-border pt-6">
                <button type="button" className="rf-fair-btn min-h-16 justify-center px-12 text-xl" onClick={reset}>{f.done}</button>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p role="status" className="inline-flex items-center gap-1.5 font-medium text-foreground">{qr.stored === "server" && <Check size={16} className="text-emerald-600" aria-hidden />}{qr.stored === "server" ? f.savedOnline : qr.stored === "queued" ? f.savedOffline : f.savedInQrOnly}</p>
                  <p>{f.resetIn(Math.max(0, KIOSK_TIMING.qrScreen - idle))} {f.kioskPrivacy}</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {prompting && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xl space-y-6 rounded-2xl bg-card p-10 text-center shadow-2xl">
            <h2 id="idle-title" className="font-display text-3xl font-semibold">{f.stillThere}</h2>
            <p className="text-lg text-muted-foreground">{f.stillThereHint(Math.max(0, limit - idle))}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" className="min-h-16 rounded-lg border border-border bg-card text-lg font-medium" onClick={reset}>{f.startOver}</button>
              <button type="button" className="rf-fair-btn min-h-16 justify-center text-lg" onClick={() => { lastActivity.current = Date.now(); setIdle(0); }}>{f.keepGoing}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
