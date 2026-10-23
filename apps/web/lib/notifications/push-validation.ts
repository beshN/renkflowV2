import { z } from 'zod';

/** Only browser push services may receive server requests, including rows saved before validation. */
export function isBrowserPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.port && (
      host === 'fcm.googleapis.com' || host === 'push.services.mozilla.com' || host === 'updates.push.services.mozilla.com' ||
      host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com')
    );
  } catch { return false; }
}
export const PushEndpointSchema = z.string().min(1).max(2048).refine(isBrowserPushEndpoint, 'Desteklenen bir tarayıcı bildirim adresi gerekli.');
const key = (bytes: number) => z.string().max(180).regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(value => Buffer.from(value, 'base64url').length === bytes, 'Geçersiz bildirim anahtarı.');
export const PushSubscriptionSchema = z.object({ endpoint: PushEndpointSchema, keys: z.object({ p256dh: key(65), auth: key(16) }) });
