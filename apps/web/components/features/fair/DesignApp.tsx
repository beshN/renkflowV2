"use client";
import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Copy, LayoutList, LinkIcon, Plus } from "lucide-react";
import { createDesign, designLink, designPath, configuratorBase, fetchDesign, updateDesign } from "@/lib/features/fair/client";
import { MAX_ITEMS, newItem, newToken, type DesignItem } from "@/lib/features/fair/design";
import { fairText, isLocale, type Locale, type PrivacyController } from "@/lib/features/fair/i18n";
import type { FairKind } from "@/lib/features/fair/products";
import { decodeDesign, fragmentPayload } from "@/lib/features/fair/transfer";
import { useMarkStandaloneScreen } from "@/lib/shared/hooks/useWorkspacePresence";
import { BrandLogo } from "./BrandLogo";
import { ItemEditor } from "./ItemEditor";
import { ItemList } from "./ItemList";
import { Landing } from "./Landing";
import { LanguageSwitch } from "./LanguageSwitch";
import { ProductPicker } from "./ProductPicker";
import { QuoteForm, type QuoteResult } from "./QuoteForm";
import { StepBar } from "./StepBar";
import { useFairLightTheme } from "./theme";

type View = "welcome" | "loading" | "notfound" | "overview" | "list" | "pick" | "edit" | "quote" | "done";
export type InitialDesign = { items: DesignItem[]; locale: Locale; version: number; fair: { code: string; name: string } | null } | null;
type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

/**
 * Phone and web configurator. Opened from a QR code or an e-mailed link (/c/<token>) it loads the
 * design — from the server, or from the QR code itself when the kiosk has not uploaded it yet —
 * and offers the two next steps: request a quote or keep editing. Every change is saved under the link.
 */
export function DesignApp({ mode, controller, token: initialToken, initial, defaultLocale }: { mode: "web" | "mobile"; controller: PrivacyController; token: string | null; initial: InitialDesign; defaultLocale: Locale }) {
  useMarkStandaloneScreen();
  useFairLightTheme();
  const [locale, setLocale] = useState<Locale>(initial?.locale ?? defaultLocale);
  const [token, setToken] = useState<string | null>(initialToken);
  const [items, setItems] = useState<DesignItem[]>(initial?.items ?? []);
  const [fair, setFair] = useState<{ code: string; name: string | null } | null>(initial?.fair ?? null);
  const [view, setView] = useState<View>(initial ? "overview" : mode === "web" ? "welcome" : "loading");
  const [editing, setEditing] = useState<{ item: DesignItem; isNew: boolean } | null>(null);
  const [save, setSave] = useState<SaveStatus>(initial ? "saved" : "idle");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const onServer = useRef(Boolean(initial));
  /** The server version this copy is based on: edits name it, so an older copy cannot overwrite newer work. */
  const version = useRef<number | null>(initial?.version ?? null);
  /** Saves run one after another; two quick edits must not both claim the same base version. */
  const saving = useRef<Promise<void>>(Promise.resolve());
  const top = useRef<HTMLDivElement>(null);
  const f = fairText(locale);

  useEffect(() => {
    const lang = new URLSearchParams(window.location.search).get("lang");
    if (isLocale(lang)) setLocale(lang);
    if (mode !== "mobile" || initial) return;
    // Not on the server (yet): the QR code carries the design itself.
    const decoded = decodeDesign(fragmentPayload(window.location.hash) || "");
    if (!decoded || !initialToken) {
      setView("notfound");
      return;
    }
    setItems(decoded.items);
    if (!isLocale(lang)) setLocale(decoded.locale);
    setFair(decoded.fairCode ? { code: decoded.fairCode, name: null } : null);
    setView("overview");
    void createDesign({ token: initialToken, fairCode: decoded.fairCode, origin: decoded.fairCode ? "kiosk" : "mobile", locale: decoded.locale, items: decoded.items }).then((r) => {
      if (!r.ok) {
        setSave("error");
        return;
      }
      onServer.current = true;
      version.current = r.data.version;
      setSave("saved");
      // Stored: the short link is enough from now on.
      window.history.replaceState(null, "", designPath(initialToken));
    });
  }, [initial, initialToken, mode]);
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, [view]);

  function persist(next: DesignItem[]) {
    setItems(next);
    // Nothing stored yet and nothing to store: an empty new design needs no link.
    if (!next.length && !onServer.current) return;
    saving.current = saving.current.then(() => store(next));
  }

  async function store(next: DesignItem[]) {
    setSave("saving");
    let t = token;
    if (!t) {
      t = newToken();
      setToken(t);
      window.history.replaceState(null, "", designPath(t));
    }
    if (!onServer.current) {
      const created = await createDesign({ token: t, fairCode: fair?.code ?? null, origin: mode === "web" ? "web" : "mobile", locale, items: next });
      if (!created.ok) {
        setSave("error");
        return;
      }
      onServer.current = true;
      version.current = created.data.version;
      if (created.data.created) {
        setSave("saved");
        return;
      }
    }
    const updated = await updateDesign(t, next, locale, version.current ?? 1);
    if (updated.ok) version.current = updated.data.version;
    setSave(updated.ok ? "saved" : updated.status === 409 ? "conflict" : "error");
  }

  /** After a conflict: show the version saved elsewhere, which is now the one being edited. */
  async function reloadLatest() {
    if (!token) return;
    const latest = await fetchDesign(token);
    if (!latest.ok) {
      setSave("error");
      return;
    }
    setItems(latest.data.design.items);
    version.current = latest.data.design.version;
    setSave("saved");
    setView("overview");
  }

  function startItem(kind: FairKind) {
    setEditing({ item: newItem(kind), isNew: true });
    setView("edit");
  }
  const full = items.length >= MAX_ITEMS;

  return (
    <div ref={top} className="rf-fair min-h-dvh">
      {view === "welcome" ? (
        <Landing locale={locale} onLocale={setLocale} campaign={null} onStart={() => setView("pick")} />
      ) : (
      <>
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo height={34} />
            <p className="hidden truncate border-l border-border pl-3 text-xs text-muted-foreground sm:block">{fair?.name ?? f.web}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitch locale={locale} onChange={setLocale} />
            {items.length > 0 && view !== "list" && view !== "done" && view !== "quote" && (
              <button type="button" aria-label={`${f.myList} (${items.length})`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium" onClick={() => setView("list")}>
                <LayoutList size={16} aria-hidden /> <span className="hidden sm:inline">{f.myList}</span>
                <span className="rounded-full bg-primary px-2 text-xs font-semibold tabular-nums text-primary-foreground">{items.length}</span>
              </button>
            )}
          </div>
        </div>
        {view !== "loading" && view !== "notfound" && (
          <StepBar locale={locale} step={view === "pick" ? 0 : view === "done" ? 3 : view === "quote" ? 2 : 1} />
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {view === "loading" && <p role="status" className="py-10 text-center text-sm text-muted-foreground">{f.loadingDesign}</p>}
        {view === "notfound" && (
          <div className="mx-auto max-w-md space-y-5 py-16 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden><LinkIcon size={28} /></span>
            <div className="space-y-2">
              <h1 role="alert" className="font-display text-2xl font-semibold">{f.designNotFound}</h1>
              <p className="text-muted-foreground">{f.notFoundHint}</p>
            </div>
            <a className="rf-fair-btn inline-flex min-h-12 justify-center px-8" href={configuratorBase() || "/"}>{f.heroCta}</a>
          </div>
        )}

        {view === "overview" && (
          <section aria-labelledby="overview-title" className="mx-auto max-w-2xl space-y-4">
            <div>
              <h1 id="overview-title" className="font-display text-2xl font-semibold">{f.designIntro}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{f.designIntroHint}</p>
            </div>
            {items.length ? <ItemList locale={locale} items={items} /> : <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-muted-foreground">{f.listEmpty}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={!token || !items.length} className="rf-fair-btn min-h-14 justify-center text-base" onClick={() => setView("quote")}>{f.getQuote}</button>
              <button type="button" className="min-h-14 rounded-lg border border-border bg-card text-base font-medium" onClick={() => setView(items.length ? "list" : "pick")}>{f.keepEditing}</button>
            </div>
            <SaveState f={f} save={save} onReload={() => void reloadLatest()} />
            {token && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  void navigator.clipboard?.writeText(designLink(token)).then(() => setCopied(true)).catch(() => {});
                }}
              >
                <Copy size={14} aria-hidden /> {copied ? f.copied : f.copyLink}
              </button>
            )}
          </section>
        )}

        {view === "list" && (
          <section aria-labelledby="list-title" className="mx-auto max-w-2xl space-y-4">
            <h1 id="list-title" className="font-display text-2xl font-semibold">{f.listTitle}</h1>
            {!items.length && <p className="text-sm text-muted-foreground">{f.listEmpty}</p>}
            <ItemList
              locale={locale}
              items={items}
              onEdit={(item) => {
                setEditing({ item, isNew: false });
                setView("edit");
              }}
              onRemove={(item) => void persist(items.filter((i) => i.id !== item.id))}
            />
            {full ? <p className="text-sm text-muted-foreground">{f.maxItems(MAX_ITEMS)}</p> : (
              <button type="button" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary" onClick={() => setView("pick")}>
                <Plus size={16} aria-hidden /> {f.addAnother}
              </button>
            )}
            <button type="button" disabled={!token || !items.length || save === "saving"} className="rf-fair-btn min-h-14 w-full justify-center text-base" onClick={() => setView("quote")}>{f.getQuote}</button>
            <SaveState f={f} save={save} onReload={() => void reloadLatest()} />
          </section>
        )}

        {view === "pick" && <ProductPicker locale={locale} onPick={startItem} disabled={full} />}

        {view === "edit" && editing && (
          <ItemEditor
            key={editing.item.id}
            locale={locale}
            item={editing.item}
            isNew={editing.isNew}
            onBack={() => setView(items.length ? "list" : "pick")}
            onSave={(item) => {
              void persist(editing.isNew ? [...items, item] : items.map((i) => (i.id === item.id ? item : i)));
              setEditing(null);
              setView("list");
            }}
          />
        )}

        {view === "quote" && token && (
          <QuoteForm
            locale={locale}
            controller={controller}
            token={token}
            fairCode={fair?.code ?? null}
            items={items}
            prepare={async () => {
              await saving.current;
              return version.current;
            }}
            onConflict={() => void reloadLatest()}
            onBack={() => setView("overview")}
            onDone={(r) => {
              setResult(r);
              onServer.current = true;
              if (r.designVersion) version.current = r.designVersion;
              setView("done");
            }}
          />
        )}

        {view === "done" && result && (
          <section className="mx-auto max-w-lg space-y-6 py-10 text-center" aria-live="polite">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-hidden><CheckCircle2 size={44} /></span>
            <div className="space-y-3">
              <h1 className="font-display text-3xl font-semibold leading-tight">{f.thanksTitle}</h1>
              <p className="text-muted-foreground">{f.thanksHint}</p>
            </div>
            {result.number && (
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">{f.requestNumber}</p>
                <p className="mt-1 font-mono text-2xl font-semibold tracking-wide">{result.number}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {result.emailStatus === "sent" ? f.emailSent(result.email) : result.emailStatus === "failed" ? f.emailNotSent : f.emailPending}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" className="min-h-12 rounded-lg border border-border bg-card text-sm font-medium" onClick={() => setView("overview")}>{f.viewDesign}</button>
              {token && (
                <button type="button" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium" onClick={() => { void navigator.clipboard?.writeText(designLink(token)).then(() => setCopied(true)).catch(() => {}); }}>
                  {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? f.copied : f.copyLink}
                </button>
              )}
            </div>
            <a className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary underline-offset-4 hover:underline" href={configuratorBase() || "/"}>{f.newDesign}</a>
          </section>
        )}
      </main>
      </>
      )}
    </div>
  );
}

function SaveState({ f, save, onReload }: { f: ReturnType<typeof fairText>; save: SaveStatus; onReload: () => void }) {
  if (save === "idle") return null;
  if (save === "conflict")
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <span className="flex-1">{f.designChanged}</span>
        <button type="button" className="min-h-10 rounded-lg border border-amber-400 bg-white px-3 font-medium" onClick={onReload}>{f.reloadDesign}</button>
      </div>
    );
  return (
    <p role={save === "error" ? "alert" : "status"} className={`inline-flex items-center gap-1.5 text-xs ${save === "error" ? "text-rose-700" : "text-muted-foreground"}`}>
      {save === "saved" && <Check size={14} className="text-emerald-600" aria-hidden />}
      {save === "saving" ? f.saving : save === "saved" ? f.savedAt : f.saveFailed}
    </p>
  );
}
