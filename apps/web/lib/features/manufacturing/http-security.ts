import "server-only";
import type { NextRequest } from "next/server";
import { WorkOrderApiError } from "../work-orders/security";

export function requireSameOriginJson(
  request: NextRequest,
  maximumBytes = 2_000_000,
) {
  requireSameOrigin(request);
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new WorkOrderApiError("JSON isteği gerekli", 415);
  if (Number(request.headers.get("content-length")) > maximumBytes)
    throw new WorkOrderApiError("İstek çok büyük", 413);
}

function isMatchingOrigin(origin: string, host: string) {
  try { return new URL(origin).host === host; } catch { return false; }
}
export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || new URL(request.url).host;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && !isMatchingOrigin(origin, host))
  )
    throw new WorkOrderApiError("Bu kaynaktan yazma isteği kabul edilmez", 403);
}
