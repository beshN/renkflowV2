"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader, StatusChip } from "@/components/kit";
import { RecordButton } from "@/components/records/RecordDrawer";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/shared/ui/Table";
import { requestJson } from "@/lib/shared/network";

type Return = {
  id: string;
  return_number: string;
  supplier_name: string;
  status: "draft" | "sent" | "closed";
  created_at: string;
  sent_at: string | null;
  closed_at: string | null;
  lines: Array<{
    id: string;
    receipt_number: string;
    item_name: string;
    quantity: number;
    uom: string;
  }>;
};
type Source = {
  id: string;
  item_name: string;
  rejected_qty: number;
  uom: string;
};
const labels = { draft: "Taslak", sent: "Gönderildi", closed: "Kapandı" };
export function SupplierReturns({ id }: { id?: string }) {
  const { data: session } = useSession();
  const scope = `${session?.user?.tenantId}:${session?.user?.id}`;
  const writable = ["owner", "admin", "office"].includes(
    String((session?.user as { role?: string })?.role),
  );
  const [rows, setRows] = useState<Return[]>([]),
    [source, setSource] = useState<Source | null>(null);
  const [quantity, setQuantity] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef<string | null>(null),
    lock = useRef(false);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const load = useCallback(
    async (signal: AbortSignal) => {
      const r = await requestJson<Return[] | Return>(
        "/api/v1/supplier-returns" + (id ? "/" + id : ""),
        { cache: "no-store", signal },
      );
      if (signal.aborted || activeScope.current !== scope) return;
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
    setRows([]);
    setSource(null);
    setQuantity("");
    pending.current = null;
    const ac = new AbortController();
    void load(ac.signal);
    const sourceId = new URLSearchParams(window.location.search).get(
      "sourceLineId",
    );
    if (!id && sourceId)
      void requestJson<{ data: Array<{ lines: Source[] }> }>(
        "/api/v1/goods-receipts",
        { cache: "no-store", signal: ac.signal },
      ).then((r) => {
        if (ac.signal.aborted || activeScope.current !== scope) return;
        const line = r.data?.data
          .flatMap((x) => x.lines)
          .find((l) => l.id === sourceId);
        if (line && Number(line.rejected_qty) > 0) setSource(line);
        else setError(r.error || "Reddedilen kabul satırı bulunamadı");
      });
    return () => ac.abort();
  }, [load, id, scope]);
  async function act(url: string, body: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await requestJson<Return>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (activeScope.current !== scope) return;
      if (!r.ok) {
        setError(r.error || "İşlem tamamlanamadı");
        return;
      }
      if (!id && r.data) {
        window.location.assign("/supplier-returns/" + r.data.id);
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
        title={id ? "Tedarikçiye iade belgesi" : "Tedarikçiye iadeler"}
        action={
          <Link className="rf-secondary-button" href="/receipts">
            Mal kabul
          </Link>
        }
      />
      {error && (
        <p role="alert" className="rf-panel text-sm">
          {error}
        </p>
      )}
      {source && writable && (
        <form
          className="rf-panel space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            pending.current ||= crypto.randomUUID();
            void act("/api/v1/supplier-returns", {
              sourceLineId: source.id,
              quantity: Number(quantity),
              idempotencyKey: pending.current,
            });
          }}
        >
          <h2 className="font-semibold">Reddedilen satırdan taslak iade</h2>
          <p>
            {source.item_name} · {Number(source.rejected_qty)} {source.uom} red
          </p>
          <label className="block text-sm">
            İade miktarı · {source.uom}
            <input
              required
              className="rf-input ml-2"
              type="number"
              min="0.000001"
              max={source.rejected_qty}
              step="any"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                pending.current = null;
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Taslak stok hareketi oluşturmaz. Önceki iadelerin ayırdığı miktar
            sunucuda kontrol edilir. Profil iadesi tam fiziksel profillerden
            oluşmalıdır.
          </p>
          <button disabled={busy} className="rf-primary-button">
            Taslak oluştur
          </button>
        </form>
      )}
      <section className="rf-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Belge</TableHead>
              <TableHead>Tedarikçi</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Satırlar</TableHead>
              <TableHead>İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={"/supplier-returns/" + r.id}>
                    {r.return_number}
                  </Link>
                </TableCell>
                <TableCell>{r.supplier_name}</TableCell>
                <TableCell>
                  <StatusChip
                    label={labels[r.status]}
                    tone={
                      r.status === "closed"
                        ? "success"
                        : r.status === "sent"
                          ? "info"
                          : "neutral"
                    }
                  />
                </TableCell>
                <TableCell>
                  {r.lines.map((l) => (
                    <p key={l.id}>
                      {l.receipt_number} · {l.item_name} · {Number(l.quantity)}{" "}
                      {l.uom}
                    </p>
                  ))}
                </TableCell>
                <TableCell>
                  <RecordButton type="supplier_return" id={r.id} />
                  {id && writable && r.status !== "closed" && (
                    <button
                      className="rf-primary-button ml-2"
                      disabled={busy}
                      onClick={() =>
                        void act("/api/v1/supplier-returns/" + r.id, {
                          status: r.status === "draft" ? "sent" : "closed",
                        })
                      }
                    >
                      {r.status === "draft"
                        ? "Gönderildi olarak onayla"
                        : "İadeyi kapat"}
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && (
          <p className="p-4 text-sm text-muted-foreground">İade belgesi yok.</p>
        )}
      </section>
      {id && rows[0] && (
        <p className="text-xs text-muted-foreground">
          Oluşturuldu: {new Date(rows[0].created_at).toLocaleString("tr-TR")} ·
          Gönderildi:{" "}
          {rows[0].sent_at
            ? new Date(rows[0].sent_at).toLocaleString("tr-TR")
            : "—"}{" "}
          · Kapandı:{" "}
          {rows[0].closed_at
            ? new Date(rows[0].closed_at).toLocaleString("tr-TR")
            : "—"}
        </p>
      )}
      {!id && (
        <p className="text-sm text-muted-foreground">
          Yeni taslağı mal kabul geçmişindeki reddedilen satırın “Tedarikçiye
          iade” girişinden açın.
        </p>
      )}
    </main>
  );
}
