"use client";
import { use, useEffect, useState } from "react";
import { requestJson } from "@/lib/shared/network";

type Sheet = {
  id: string; code: string; status: string; rework: boolean; createdAt: string; approvedAt: string | null;
  parameters: { kerfMm: number; trimStartMm: number; trimEndMm: number; minimumRemnantMm: number };
  parameterSource: string | null; notice: string | null; algorithm: string; wastePercent: number; reusableMm: number; unfulfilled: number;
  purchase: Array<{ item: { sku: string; name: string } | null; color: string; lengthMm: number; bars: number; pieces: number }>;
  tooLong: Array<{ item: { sku: string; name: string } | null; color: string; lengthMm: number }>;
  bars: Array<{
    position: number; lotNumber: string | null; item: { sku: string; name: string } | null; color: string; lengthMm: number; isRemnant: boolean;
    pieces: Array<{ lengthMm: number; job: { title: string; orderNumber: string } | null }>; remainingMm: number; reusable: boolean; lossMm: number;
  }>;
};

/** Job titles usually start with the order number already; it is added only when missing. */
const jobLabel = (job: { title: string; orderNumber: string } | null) =>
  !job ? "—" : job.title.includes(job.orderNumber) ? job.title : `${job.title} · ${job.orderNumber}`;

const STATUS: Record<string, string> = { draft: "Taslak (onay bekliyor)", approved: "Onaylandı, profiller ayrıldı", completed: "Kesildi", cancelled: "İptal" };

/** The saw operator's sheet: printed, or saved as PDF from the browser's print dialog. */
export default function CutPlanPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sheet, setSheet] = useState<Sheet | null>(null), [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    requestJson<{ data: Sheet }>(`/api/v1/production/cut-plans/${id}`, { signal: c.signal }).then((r) => {
      if (c.signal.aborted) return;
      if (r.ok && r.data?.data) { setSheet(r.data.data); setError(""); } else setError(r.error || "Kesim planı alınamadı");
    });
    return () => c.abort();
  }, [id]);
  if (error) return <p role="alert" className="rf-page">{error}</p>;
  if (!sheet) return <p role="status" className="rf-page">Kesim föyü hazırlanıyor…</p>;
  const p = sheet.parameters;
  return (
    <div className="cut-sheet rf-print-document mx-auto max-w-4xl p-6 text-sm">
      {/* Shell, sidebar and header are hidden by the shared print rules (styles/workspace.css). */}
      <style>{`@media print { [data-ai-chatbot],.rf-command-launcher,.pwa-install-prompt { display:none!important } .cut-bar { break-inside:avoid } .cut-estimate { border:2px solid #111!important;background:white!important;color:#111!important } @page { size:A4;margin:12mm } }`}</style>
      <button className="rf-primary-button mb-6 print:hidden" onClick={() => window.print()}>Yazdır / PDF olarak kaydet</button>
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-semibold">{sheet.rework ? "Rework kesim föyü" : "Kesim föyü"} · {sheet.code}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{STATUS[sheet.status] ?? sheet.status} · {new Date(sheet.createdAt).toLocaleString("tr-TR")}</p>
        </div>
        <p className="text-right text-xs">{sheet.bars.length} çubuk · %{Number(sheet.wastePercent).toFixed(1)} fire · {sheet.reusableMm} mm artık</p>
      </div>
      {sheet.status !== "approved" && sheet.status !== "completed" && (
        <p role="alert" className="cut-estimate mt-4 rounded border-2 border-rose-500 p-3 text-base font-bold">
          {sheet.status === "cancelled"
            ? "İPTAL EDİLMİŞ PLAN: bu föye göre kesmeyin."
            : "TASLAK: plan onaylanmadı, profiller ayrılmadı. Onaylanmadan bu föye göre kesmeyin."}
        </p>
      )}
      {sheet.notice && (
        <p role="note" className="cut-estimate mt-4 rounded border-2 border-amber-500 bg-amber-50 p-3 font-semibold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          {sheet.notice} Ölçüleri kesmeden önce kontrol edin.
        </p>
      )}
      <p className="mt-4 text-xs">
        Kullanılan değerler: testere payı {p.kerfMm} mm · baş tıraş {p.trimStartMm} mm · son tıraş {p.trimEndMm} mm · en kısa kullanılabilir artık {p.minimumRemnantMm} mm
      </p>
      {sheet.unfulfilled > 0 && (
        <div className="mt-4 rounded border border-border p-3 text-xs">
          <p className="font-semibold">{sheet.unfulfilled} parça için stokta uygun profil yok; bu föy onaylanamaz.</p>
          {sheet.purchase.length > 0 && <ul className="mt-1 list-disc pl-5">{sheet.purchase.map((l, i) => <li key={i}>Satın alma: {l.item ? `${l.item.sku} ${l.item.name}` : "Profil"} · {l.color} · {l.bars} × {l.lengthMm} mm çubuk ({l.pieces} parça)</li>)}</ul>}
          {sheet.tooLong.length > 0 && <ul className="mt-1 list-disc pl-5">{sheet.tooLong.map((piece, i) => <li key={i}>{piece.item ? `${piece.item.sku} ${piece.item.name}` : "Profil"} · {piece.color} · {piece.lengthMm} mm: standart çubuktan uzun, satın almayla karşılanmaz</li>)}</ul>}
        </div>
      )}
      <ol className="mt-4 space-y-3">
        {sheet.bars.map((bar) => (
          <li key={bar.position} className="cut-bar rounded border border-border p-3">
            <div className="flex flex-wrap justify-between gap-2 font-medium">
              <span>{bar.position}. {bar.item ? `${bar.item.sku} · ${bar.item.name}` : "Profil"} · {bar.color}</span>
              <span>{bar.isRemnant ? "Artık" : "Çubuk"} {bar.lengthMm} mm{bar.lotNumber ? ` · Lot ${bar.lotNumber}` : ""}</span>
            </div>
            <table className="mt-2 w-full text-xs">
              <thead><tr className="text-left text-muted-foreground"><th className="w-8 py-1">☐</th><th>Kesim</th><th>İş / sipariş</th></tr></thead>
              <tbody>
                {bar.pieces.map((piece, n) => (
                  <tr key={n} className="border-t border-border"><td className="py-1">☐</td><td className="font-semibold">{piece.lengthMm} mm</td><td>{jobLabel(piece.job)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs">
              {bar.reusable ? `Kalan ${bar.remainingMm} mm: artık deposuna etiketleyin.` : `Kalan ${bar.remainingMm} mm: fire.`} Ölçülen kalan: ________ mm
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[11px] text-muted-foreground">Hesap kesim motoruyla yapıldı ({sheet.algorithm}); birden çok yerleşim karşılaştırılır, en iyisi olduğu kanıtlanmaz.</p>
    </div>
  );
}
