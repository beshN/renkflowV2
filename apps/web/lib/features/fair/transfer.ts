import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import { DesignItemsSchema, fromBase64Url, LocaleSchema, toBase64Url, type DesignItem } from './design';
import type { Locale } from './i18n';

/**
 * The design travels inside the QR code itself (in the URL fragment, which browsers never send to
 * the server), so a phone can open a kiosk design even before the offline kiosk has uploaded it.
 * Preview images stay out: the phone renders its own 3D view.
 */
const PayloadSchema = z.object({ v: z.literal(1), f: z.string().max(40).nullable(), l: LocaleSchema, i: DesignItemsSchema }).strict();
export type TransferPayload = { fairCode: string | null; locale: Locale; items: DesignItem[] };

export function encodeDesign({ fairCode, locale, items }: TransferPayload): string {
  const compact = items.map(({ image: _image, ...rest }) => rest);
  return toBase64Url(deflateSync(strToU8(JSON.stringify({ v: 1, f: fairCode, l: locale, i: compact })), { level: 9 }));
}

export function decodeDesign(fragment: string): TransferPayload | null {
  try {
    if (!fragment || fragment.length > 4000) return null;
    const parsed = PayloadSchema.safeParse(JSON.parse(strFromU8(inflateSync(fromBase64Url(fragment)))));
    return parsed.success ? { fairCode: parsed.data.f, locale: parsed.data.l, items: parsed.data.i } : null;
  } catch {
    return null;
  }
}

/** `#d=<payload>` from a location hash. */
export function fragmentPayload(hash: string): string | null {
  const match = /(?:^#|&)d=([A-Za-z0-9_-]+)/.exec(hash);
  return match ? match[1] : null;
}
