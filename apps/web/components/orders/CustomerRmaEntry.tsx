"use client";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { requestJson } from "@/lib/shared/network";
type Source = { id: string; delivered_qty: number };
export function CustomerRmaEntry({
  orderId,
  lineId,
}: {
  orderId: string;
  lineId: string;
}) {
  const { data: session } = useSession();
  const url =
    "/api/v1/customer-rmas/sources?orderId=" + encodeURIComponent(orderId);
  const { data } = useSWR(
    session?.user ? [url, session.user.tenantId, session.user.id] : null,
    async ([endpoint]: string[]) => {
      const result = await requestJson<Source[]>(endpoint, {
        cache: "no-store",
      });
      return result.ok ? result.data : null;
    },
  );
  return data?.some((l) => l.id === lineId && Number(l.delivered_qty) > 0) ? (
    <Link
      className="rf-secondary-button"
      href={
        "/customer-rmas?orderId=" +
        encodeURIComponent(orderId) +
        "&sourceLineId=" +
        encodeURIComponent(lineId)
      }
    >
      Müşteri iadesi
    </Link>
  ) : null;
}
