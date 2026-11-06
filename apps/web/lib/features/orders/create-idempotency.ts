import { createHash } from 'node:crypto';
import type { NewOrderFormData } from '@/lib/types';

// Sort object keys; array order is meaningful. Hash the original accepted input,
// not mutable order rows (customer linking, later edits and status transitions).
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

export async function orderCreateRequestHash(data: NewOrderFormData, files: File[] = []): Promise<string> {
  const attachments = await Promise.all(files.map(async (file) => ({
    name: file.name,
    type: file.type,
    size: file.size,
    sha256: createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'),
  })));
  return createHash('sha256').update(JSON.stringify(canonical({ data, attachments }))).digest('hex');
}
