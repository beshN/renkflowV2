/**
 * Per-person notification preferences: which kinds of events reach a person on which channel.
 * Only the in-app channel delivers today; e-mail and push are stored for when they are connected,
 * and the screen says so instead of pretending they send.
 */
import type { NotificationType } from './service';

export const PREFERENCE_EVENTS: Array<{ type: NotificationType; label: string; hint: string }> = [
  { type: 'work_order:assigned', label: 'Bana iş atandığında', hint: 'Üretim emri ya da görev size verildiğinde' },
  { type: 'mention', label: 'Benden bahsedildiğinde', hint: 'Bir kayıtta @adınız yazıldığında' },
  { type: 'reminder', label: 'Hatırlatmalar', hint: 'Size verilen etkinliğin günü geldiğinde' },
  { type: 'order:updated', label: 'Sipariş değişiklikleri', hint: 'Malzeme eksiği, değişiklik emri gibi gelişmeler' },
  { type: 'order:delayed', label: 'Gecikmeler', hint: 'Termin geçtiğinde ya da iş geciktiğinde' },
  { type: 'system', label: 'Müşteri ve sistem bildirimleri', hint: 'Müşteri teklifi onayladığında ya da reddettiğinde' },
];

export const PREFERENCE_CHANNELS = [
  { key: 'inApp', label: 'Uygulama içi' },
  { key: 'email', label: 'E-posta' },
  { key: 'push', label: 'Anlık bildirim' },
] as const;
export type PreferenceChannel = (typeof PREFERENCE_CHANNELS)[number]['key'];

/** Which channels actually deliver event notices on this installation. */
export function channelStatus(env: { pushConfigured: boolean }): Record<PreferenceChannel, { connected: boolean; note: string | null }> {
  return {
    inApp: { connected: true, note: null },
    email: { connected: false, note: 'Olay e-postaları henüz bağlanmadı; seçiminiz saklanır, bağlandığında uygulanır.' },
    push: { connected: false, note: env.pushConfigured ? 'Olay anlık bildirimleri henüz bağlanmadı; seçiminiz saklanır.' : 'Bu kurulumda anlık bildirim yapılandırılmadı.' },
  };
}

export type PreferenceMatrix = Record<PreferenceChannel, Record<string, boolean>>;

/** Fills every known event × channel (default on) and drops anything unknown. */
export function normalizePreferences(raw: Partial<Record<PreferenceChannel, unknown>> | null | undefined): PreferenceMatrix {
  const out = { inApp: {}, email: {}, push: {} } as PreferenceMatrix;
  for (const { key } of PREFERENCE_CHANNELS) {
    const given = raw?.[key] && typeof raw[key] === 'object' ? (raw[key] as Record<string, unknown>) : {};
    for (const { type } of PREFERENCE_EVENTS) out[key][type] = given[type] !== false;
  }
  return out;
}
