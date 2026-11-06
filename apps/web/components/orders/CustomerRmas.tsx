"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MemberAccessView } from "@/lib/hooks/useMemberAccess";
import { useSession } from "next-auth/react";
import { PageHeader, StatusChip } from "@/components/kit";
import { RecordButton } from "@/components/records/RecordDrawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shared/ui/Table";
import { requestJson } from "@/lib/shared/network";
type Rma = {
  id: string;
  return_number: string;
  order_number: string;
  decision: "pending" | "repair" | "replace" | "reject";
  service_ticket_id: string | null;
  replacement_work_order_id: string | null;
  replacement_approved_at: string | null;
  lines: Array<{
    id: string;
    quantity: number;
    uom: string;
    reason: string;
    photo_attachment_id: string | null;
  }>;
};
type Source = {
  id: string;
  product_name: string;
  uom: string;
  delivered_qty: number;
};
const labels = {
  pending: "Karar bekliyor",
  repair: "Onar",
  replace: "Değiştir",
  reject: "Reddet",
};
export function CustomerRmas({ id }: { id?: string }) {
  const { data: session } = useSession();
  const scope = `${session?.user?.tenantId}:${session?.user?.id}`;
  const current = useRef(scope);
  current.current = scope;
  const [access, setAccess] = useState<MemberAccessView | null>(null);
  const editable = Boolean(access?.permissions.service?.includes("edit"));
  const creatable = Boolean(access?.permissions.service?.includes("create"));
  const replaceable =
    editable && Boolean(access?.permissions.production?.includes("create"));
  const approvable =
    editable && Boolean(access?.permissions.production?.includes("approve"));
  const [rows, setRows] = useState<Rma[]>([]),
    [source, setSource] = useState<Source | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [quantity, setQuantity] = useState(""),
    [reason, setReason] = useState("");
  const key = useRef<string | null>(null),
    lock = useRef(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const r = await requestJson<Rma[] | Rma>(
        "/api/v1/customer-rmas" + (id ? "/" + id : ""),
        { cache: "no-store", signal },
      );
      if (signal.aborted || current.current !== scope) return;
      if (r.ok && r.data) {
        setRows(Array.isArray(r.data) ? r.data : [r.data]);
        setError("");
      } else {
        setRows([]);
        setError(r.error || "İadeler alınamadı");
      }
    },
    [id, scope],
  );
  useEffect(() => {
    setAccess(null);
    setRows([]);
    setSource(null);
    setQuantity("");
    setReason("");
    key.current = null;
    const ac = new AbortController();
    void requestJson<MemberAccessView>("/api/v1/me/access", {
      cache: "no-store",
      signal: ac.signal,
    }).then((r) => {
      if (!ac.signal.aborted && current.current === scope) setAccess(r.data);
    });
    void load(ac.signal);
    const params = new URLSearchParams(window.location.search),
      orderId = params.get("orderId"),
      lineId = params.get("sourceLineId");
    if (!id && orderId && lineId)
      void requestJson<Source[]>(
        "/api/v1/customer-rmas/sources?orderId=" + encodeURIComponent(orderId),
        { cache: "no-store", signal: ac.signal },
      ).then((r) => {
        if (ac.signal.aborted || current.current !== scope) return;
        const line = r.data?.find(
          (l) => l.id === lineId && Number(l.delivered_qty) > 0,
        );
        if (line) setSource(line);
        else setError(r.error || "Teslim edilmiş kalem bulunamadı");
      });
    return () => ac.abort();
  }, [load, id, scope]);
  async function act(body: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await requestJson<Rma>(
        "/api/v1/customer-rmas" + (id ? "/" + id : ""),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (current.current !== scope) return;
      if (!r.ok) {
        setError(r.error || "İşlem tamamlanamadı");
        return;
      }
      if (!id && r.data) {
        window.location.assign("/customer-rmas/" + r.data.id);
        return;
      }
      await load(new AbortController().signal);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="rf-page space-y-5">
      <PageHeader
        title={id ? "Müşteri iadesi" : "Müşteri iadeleri"}
        action={
          <Link className="rf-secondary-button" href="/orders">
            Siparişler
          </Link>
        }
      />
      <p className="rf-panel text-sm">
        Stok geri alımı fiziksel kabul gerektirir. Bu akış stok artırmaz.
        Değişim yalnız insan onayı bekleyen taslak iş emri açar; üretimi
        başlatmaz.
      </p>
      {error && (
        <p role="alert" className="rf-panel">
          {error}
        </p>
      )}
      {source && creatable && (
        <form
          className="rf-panel space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            key.current ||= crypto.randomUUID();
            void act({
              sourceLineId: source.id,
              quantity: Number(quantity),
              reason,
              idempotencyKey: key.current,
            });
          }}
        >
          <h2>Teslim edilmiş kalemden taslak RMA</h2>
          <p>
            {source.product_name} · Teslim: {Number(source.delivered_qty)}{" "}
            {source.uom}
          </p>
          <label className="block">
            İade miktarı ({source.uom})
            <input
              className="rf-input"
              type="number"
              min="0.000001"
              max={source.delivered_qty}
              step="any"
              required
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                key.current = null;
              }}
            />
          </label>
          <label className="block">
            Neden
            <textarea
              className="rf-input"
              required
              maxLength={2000}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                key.current = null;
              }}
            />
          </label>
          <p className="text-sm">
            Fotoğrafı RMA oluşturulduktan sonra kayıt çekmecesinden ekleyin.
            Önceki iadelerin ayırdığı miktar sunucuda kontrol edilir.
          </p>
          <button className="rf-primary-button" disabled={busy}>
            Taslak oluştur
          </button>
        </form>
      )}
      <section className="rf-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Belge / sipariş</TableHead>
              <TableHead>Karar</TableHead>
              <TableHead>Satırlar</TableHead>
              <TableHead>İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={"/customer-rmas/" + r.id}>{r.return_number}</Link>
                  <p>{r.order_number}</p>
                </TableCell>
                <TableCell>
                  <StatusChip
                    label={labels[r.decision]}
                    tone={r.decision === "pending" ? "neutral" : "info"}
                  />
                </TableCell>
                <TableCell>
                  {r.lines.map((l) => (
                    <p key={l.id}>
                      {Number(l.quantity)} {l.uom} · {l.reason}
                      {l.photo_attachment_id && (
                        <a
                          className="ml-2 underline"
                          href={
                            "/api/v1/records/attachments/" +
                            l.photo_attachment_id
                          }
                        >
                          Kaynak fotoğraf
                        </a>
                      )}
                    </p>
                  ))}
                </TableCell>
                <TableCell>
                  <RecordButton type="customer_rma" id={r.id} />
                  {id &&
                    editable &&
                    r.decision === "pending" &&
                    (["repair", "replace", "reject"] as const)
                      .filter(
                        (decision) => decision !== "replace" || replaceable,
                      )
                      .map((decision) => (
                        <button
                          key={decision}
                          disabled={busy}
                          className="rf-secondary-button ml-2"
                          onClick={() => void act({ decision })}
                        >
                          {labels[decision]}
                        </button>
                      ))}
                  {id && r.replacement_work_order_id && (
                    <div>
                      <Link
                        href={"/work-orders/" + r.replacement_work_order_id}
                      >
                        Değişim taslak iş emri
                      </Link>
                      {!r.replacement_approved_at ? (
                        approvable ? (
                          <button
                            className="rf-primary-button ml-2"
                            disabled={busy}
                            onClick={() =>
                              void act({ action: "approveReplacement" })
                            }
                          >
                            Değişim taslağını onayla
                          </button>
                        ) : (
                          <p>İnsan onayı bekleniyor.</p>
                        )
                      ) : (
                        <p>
                          İnsan onayı verildi. Üretim planı ayrıca hazırlanır.
                        </p>
                      )}
                    </div>
                  )}
                  {id && (
                    <p>
                      {r.service_ticket_id
                        ? "Servis kaydına bağlı."
                        : "Bağ kurulmadı: siparişe ait mevcut servis kaydı yok."}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <p className="p-4">İade belgesi yok.</p>}
      </section>
    </main>
  );
}
