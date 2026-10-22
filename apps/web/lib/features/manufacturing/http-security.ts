import "server-only";
import type { NextRequest } from "next/server";
import { WorkOrderApiError } from "../work-orders/security";

export function requireSameOriginJson(
  request: NextRequest,
  maximumBytes = 2_000_000,
) {
  requireSameOrigin(request);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")?.trim() || ""))
    throw new WorkOrderApiError("JSON isteği gerekli", 415);
  if (Number(request.headers.get("content-length")) > maximumBytes)
    throw new WorkOrderApiError("İstek çok büyük", 413);
}

function isMatchingOrigin(origin: string, request: NextRequest, host: string) {
  try {
    const source = new URL(origin), expected = new URL(request.url);
    expected.host = host;
    return source.origin === expected.origin && !source.username && !source.password && source.pathname === '/' && !source.search && !source.hash;
  } catch { return false; }
}
export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || new URL(request.url).host;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && !isMatchingOrigin(origin, request, host))
  )
    throw new WorkOrderApiError("Bu kaynaktan yazma isteği kabul edilmez", 403);
}
