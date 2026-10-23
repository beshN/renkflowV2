import 'server-only';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

/** Validate the media type exactly; a declared length is only an early rejection, never proof. */
export function requireJsonBody(request: Request, maximumBytes = 2_000_000) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')?.trim() || ''))
    throw new WorkOrderApiError('JSON isteği gerekli.', 415);
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))))
    throw new WorkOrderApiError('Geçersiz istek boyutu.', 400);
  if (length !== null && Number(length) > maximumBytes)
    throw new WorkOrderApiError('İstek çok büyük.', 413);
}

/** Bound actual UTF-8 bytes, including chunked uploads and an absent/understated Content-Length. */
export async function readJsonBody(request: Request, maximumBytes = 2_000_000): Promise<unknown> {
  requireJsonBody(request, maximumBytes);
  const reader = request.body?.getReader();
  if (!reader) throw new WorkOrderApiError('İstek gövdesi gerekli.', 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        // A broken upload's cancellation must not replace the useful 413 response.
        await reader.cancel().catch(() => {});
        throw new WorkOrderApiError('İstek çok büyük.', 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof WorkOrderApiError) throw error;
    throw new WorkOrderApiError('İstek okunamadı. Tekrar deneyin.', 400);
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes)));
  } catch {
    throw new WorkOrderApiError('Geçersiz JSON.', 400);
  }
}
