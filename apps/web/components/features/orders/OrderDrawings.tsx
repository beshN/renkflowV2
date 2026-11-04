"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { requestJson } from "@/lib/shared/network";
import type { orderDrawings } from "@/lib/features/orders/makasli-drawing.server";
type Drawings = Awaited<ReturnType<typeof orderDrawings>>;
export function OrderDrawings({
  orderId,
  printable = false,
}: {
  orderId: string;
  printable?: boolean;
}) {
  const [data, setData] = useState<Drawings | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    requestJson<Drawings>(`/api/v1/orders/${orderId}/drawing`, {
      signal: controller.signal,
      cache: "no-store",
    }).then((r) => {
      if (controller.signal.aborted) return;
      if (r.ok && r.data) setData(r.data);
      else setError(r.error || "Çizim alınamadı");
    });
    return () => controller.abort();
  }, [orderId]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Çizim hazırlanıyor…</p>;
  if (!data.lines.length) return <p>Makaslı tente kalemi yok.</p>;
  return (
    <section
      className="rf-panel rf-print-document space-y-4 border border-border p-4"
      aria-label="Makaslı tente imalat ölçü föyü"
    >
      <h2 className="font-semibold">İmalat ölçü föyü · {data.orderNumber}</h2>
      <div className="print:hidden">
        {printable ? (
          <button className="rf-primary-button" onClick={() => window.print()}>
            Yazdır / PDF olarak kaydet
          </button>
        ) : (
          <Link
            className="rf-secondary-button"
            href={`/orders/${orderId}/manufacturing`}
          >
            İmalat ölçü föyü / PDF
          </Link>
        )}
      </div>
      <p className="text-sm">
        Kayıtlı sipariş kalemi ölçüleri. İmalat öncesi insan onayı gerekir;
        onaylı teknik plan yerine geçmez.
      </p>
      {data.lines.map((line) => (
        <figure key={line.id} className="break-inside-avoid">
          <figcaption>
            {line.productName} · Kalem {line.id}
          </figcaption>
          {line.svg ? (
            <div dangerouslySetInnerHTML={{ __html: line.svg }} />
          ) : (
            <p role="note">{line.message}</p>
          )}
        </figure>
      ))}
    </section>
  );
}
