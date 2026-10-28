import "server-only";
import { NextResponse, type NextRequest } from "next/server";
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
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || new URL(request.url).host;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && !isMatchingOrigin(origin, host))
  )
    throw new WorkOrderApiError("Bu kaynaktan yazma isteği kabul edilmez", 403);
}

// For handlers whose catch blocks don't map WorkOrderApiError: same check, but
// hands back the 403 so a cross-site write never reaches the generic 500 path.
export function crossOriginRejection(request: Request) {
  try { requireSameOrigin(request); return null; }
  catch (error) {
    if (!(error instanceof WorkOrderApiError)) throw error;
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
}

/**
 * The body as JSON, read at most `maximumBytes` bytes. Content-Length alone is not enough: a chunked
 * request has none, so the bytes are counted while reading and the read stops at the limit.
 */
export async function readJsonLimited(request: Request, maximumBytes = 2_000_000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new WorkOrderApiError("Geçersiz istek", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel().catch(() => {});
      throw new WorkOrderApiError("İstek çok büyük", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new WorkOrderApiError("Geçersiz JSON", 400);
  }
}
