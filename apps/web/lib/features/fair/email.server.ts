import 'server-only';

import { sendEmail } from '@/lib/notifications/email';
import { itemSpecs, itemSummary, type DesignItem } from './design';
import { fairText, productName, type Locale } from './i18n';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const COPY: Record<Locale, { subject: (n: string) => string; hello: (n: string) => string; intro: string; open: string; next: string }> = {
  en: { subject: (n) => `Your quote request ${n}`, hello: (n) => `Hello ${n},`, intro: 'Thank you for your quote request. We have received the following design:', open: 'Open your design', next: 'Our sales team will prepare your quote and get in touch with you.' },
  de: { subject: (n) => `Ihre Angebotsanfrage ${n}`, hello: (n) => `Hallo ${n},`, intro: 'vielen Dank für Ihre Angebotsanfrage. Wir haben folgenden Entwurf erhalten:', open: 'Entwurf öffnen', next: 'Unser Vertriebsteam erstellt Ihr Angebot und meldet sich bei Ihnen.' },
  tr: { subject: (n) => `Teklif talebiniz ${n}`, hello: (n) => `Merhaba ${n},`, intro: 'Teklif talebiniz için teşekkür ederiz. Aşağıdaki tasarımı aldık:', open: 'Tasarımınızı açın', next: 'Satış ekibimiz teklifinizi hazırlayıp sizinle iletişime geçecek.' },
};

export function quoteEmailHtml(p: { locale: Locale; firm: string; number: string; contactName: string; items: DesignItem[]; designUrl: string }) {
  const c = COPY[p.locale];
  const f = fairText(p.locale);
  const items = p.items
    .map((item) => {
      const rows = itemSpecs(p.locale, item, { withHex: false }).map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#667">${esc(k)}</td><td style="padding:2px 0">${esc(v)}</td></tr>`).join('');
      return `<div style="border:1px solid #e3e5e4;border-radius:8px;padding:12px 14px;margin:0 0 10px"><strong>${esc(item.quantity > 1 ? `${item.quantity} × ` : '')}${esc(productName(p.locale, item.kind))}</strong><table style="font-size:14px;margin-top:6px;border-collapse:collapse">${rows}</table></div>`;
    })
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f4f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2a30">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
<p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#667;margin:0 0 16px">${esc(p.firm)}</p>
<div style="background:#fff;border-radius:12px;padding:24px">
<p style="margin:0 0 12px">${esc(c.hello(p.contactName))}</p>
<p style="margin:0 0 16px">${esc(c.intro)}</p>
<p style="margin:0 0 16px;font-size:14px">${esc(f.requestNumber)}: <strong>${esc(p.number)}</strong></p>
${items}
<p style="margin:20px 0"><a href="${esc(p.designUrl)}" style="display:inline-block;background:#1f2a30;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">${esc(c.open)}</a></p>
<p style="margin:0;font-size:13px;color:#667;word-break:break-all">${esc(p.designUrl)}</p>
<p style="margin:20px 0 0">${esc(c.next)}</p>
</div></div></body></html>`;
}

/** Sends the customer confirmation; the result says honestly whether it went out. */
export async function sendQuoteConfirmation(p: Parameters<typeof quoteEmailHtml>[0] & { to: string }): Promise<{ status: 'sent' | 'failed' | 'not_configured'; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { status: 'not_configured', error: 'RESEND_API_KEY is not set' };
  const result = await sendEmail({
    to: p.to,
    subject: `${COPY[p.locale].subject(p.number)} · ${itemSummary(p.locale, p.items[0])}`.slice(0, 180),
    html: quoteEmailHtml(p),
    from: process.env.FAIR_EMAIL_FROM?.trim() || undefined,
  });
  if (result.success) return { status: 'sent' };
  const error = result.error;
  return { status: 'failed', error: (typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error ? String((error as any).message) : 'send failed').slice(0, 300) };
}
