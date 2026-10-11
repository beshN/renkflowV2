"use client";
import { use, useCallback, useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, Circle, PackageX } from "lucide-react";
import { Skeleton } from "@/components/kit";

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
  const [data, setData] = useState<SignOff>();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/v1/public/signoff/${token}`, { cache: "no-store" });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) setError(body.error || "Bağlantı açılamadı");
    else setData(body);
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch(`/api/v1/public/signoff/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, accept: true, note: note || null }) });
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setError(body.error || "İmza kaydedilemedi");
    else await load();
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-background p-4 text-foreground md:p-8">
      {error && !data && <p role="alert" className="rf-panel p-4 text-sm">{error}</p>}
      {!data && !error && <Skeleton className="h-64" />}
      {data && (
        <>
          <header className="space-y-1 border-b border-border pb-3">
            <p className="rf-eyebrow">{data.firm}</p>
            <h1 className="rf-page-title">Montaj teslim onayı</h1>
            <p className="text-sm">{data.customerName} · sipariş {data.orderNumber} · montaj {data.number}{data.date ? ` · ${data.date}` : ""}</p>
          </header>
          <section className="rf-panel space-y-2 p-4" aria-label="Yapılan iş">
            <h2 className="text-sm font-semibold">Monte edilen ürünler</h2>
            <ul className="space-y-1 text-sm">
              {data.items.map((i, n) => (
                <li key={n}>{i.quantity} × {i.productName}{i.widthMm ? ` · ${i.widthMm}${i.heightMm ? ` × ${i.heightMm}` : ""} mm` : ""}{i.color ? ` · ${i.color}` : ""}</li>
              ))}
            </ul>
            {data.checklist.length > 0 && (
              <>
                <h2 className="pt-2 text-sm font-semibold">Kontrol listesi</h2>
                <ul className="space-y-1 text-sm">
                  {data.checklist.map((c, n) => <li key={n} className="flex items-center gap-2">{c.done ? <CheckCircle2 size={16} className="text-emerald-600" aria-label="Yapıldı" /> : <Circle size={16} className="text-muted-foreground" aria-label="Yapılmadı" />}{c.title}</li>)}
                </ul>
              </>
            )}
            {data.issues.length > 0 && (
              <>
                <h2 className="flex items-center gap-1 pt-2 text-sm font-semibold"><PackageX size={16} aria-hidden /> Not edilen eksik / hasar</h2>
                <ul className="list-disc pl-5 text-sm">{data.issues.map((i, n) => <li key={n}>{i.kind === "missing" ? "Eksik" : "Hasar"}: {i.text}</li>)}</ul>
              </>
            )}
          </section>
          {data.signed ? (
            <p role="status" className="rf-panel flex items-center gap-2 p-4 text-sm"><BadgeCheck size={18} className="text-emerald-600" aria-hidden /> {data.signed.name} tarafından {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.signed.at))} tarihinde teslim alındı.</p>
          ) : (
            <form onSubmit={sign} className="rf-panel space-y-3 p-4" aria-label="Teslim imzası">
              {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
              <label className="block text-sm">Adınız soyadınız<input className="rf-input mt-1 w-full" required minLength={3} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
              <label className="block text-sm">Not (isteğe bağlı)<textarea className="rf-input mt-1 w-full" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" required checked={accept} onChange={(e) => setAccept(e.target.checked)} /> Yukarıdaki montajı teslim aldım; not edilen eksikler dışında iş tamamdır.</label>
              <button type="submit" className="rf-primary-button w-full text-sm sm:w-auto" disabled={busy || !accept}>Teslimi onayla</button>
              <p className="text-xs text-muted-foreground">Onayınız adınız, saat ve bağlantı bilgisiyle firmanın kaydına yazılır.</p>
            </form>
          )}
        </>
      )}
    </main>
  );
}
