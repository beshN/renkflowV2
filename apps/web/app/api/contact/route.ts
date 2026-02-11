import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { RateLimiter } from '@/lib/rateLimiter';
import { ANALYTICS_EVENTS } from '@/lib/analytics/event-schema';

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const contactRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
  blockDurationMs: 15 * 60 * 1000,
  keyPrefix: 'contact:',
});

const ContactRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  subject: z.enum(['general', 'technical', 'sales']).optional().default('general'),
  message: z.string().trim().min(10).max(5000),
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  pagePath: z.string().trim().max(512).optional(),
  locale: z.string().trim().max(12).optional(),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function resolvePagePath(request: NextRequest, candidate?: string): string | null {
  const direct = candidate?.trim();
  if (direct?.startsWith('/')) {
    return direct.slice(0, 512);
  }

  const referer = request.headers.get('referer');
  if (!referer) return null;

  try {
    const parsed = new URL(referer);
    return parsed.pathname.slice(0, 512) || null;
  } catch {
    return null;
  }
}

function resolveLocale(request: NextRequest, candidate?: string): string | null {
  const direct = candidate?.trim();
  if (direct) return direct.slice(0, 12);

  const acceptLanguage = request.headers.get('accept-language') || '';
  const primary = acceptLanguage.split(',')[0]?.trim();
  return primary ? primary.slice(0, 12) : null;
}

function resolveClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  return forwarded || realIp || cfIp || null;
}

export async function POST(request: NextRequest) {
  try {
    const limit = await contactRateLimiter.check(request, 'contact-form');
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.' },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Geçersiz istek formatı.' },
        { status: 400 }
      );
    }

    const parsedBody = ContactRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message || 'Geçersiz alanlar.' },
        { status: 400 }
      );
    }

    const { name, email, subject, message, tenantId, userId } = parsedBody.data;
    const pagePath = resolvePagePath(request, parsedBody.data.pagePath);
    const locale = resolveLocale(request, parsedBody.data.locale);
    const userAgent = (request.headers.get('user-agent') || '').slice(0, 512) || null;
    const ipAddress = resolveClientIp(request);

    // Map subject codes to readable names
    const subjectMap: Record<string, string> = {
      general: 'Genel Sorular',
      technical: 'Teknik Destek',
      sales: 'Satış',
    };

    const subjectText = subjectMap[subject] || 'Genel Sorular';
    const safeName = escapeHtml(String(name));
    const safeEmail = escapeHtml(String(email));
    const safeMessage = escapeHtml(String(message));
    const safeSubject = escapeHtml(subjectText);
    const safeNameForSubject = sanitizeHeaderValue(String(name));
    const safePagePath = pagePath ? escapeHtml(pagePath) : '-';
    const safeLocale = locale ? escapeHtml(locale) : '-';
    const safeTenantId = tenantId ? escapeHtml(tenantId) : '-';
    const safeUserId = userId ? escapeHtml(userId) : '-';
    const safeUserAgent = userAgent ? escapeHtml(userAgent) : '-';

    let supportTicketId: string | null = null;
    try {
      const ticketRows = await sql`
        INSERT INTO support_tickets (
          tenant_id,
          user_id,
          source,
          status,
          priority,
          name,
          email,
          subject,
          message,
          page_path,
          locale,
          user_agent,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          ${tenantId || null},
          ${userId || null},
          'contact_form',
          'open',
          'medium',
          ${name},
          ${email},
          ${subjectText},
          ${message},
          ${pagePath},
          ${locale},
          ${userAgent},
          ${{
            ipAddress,
            referrer: request.headers.get('referer') || null,
            event: ANALYTICS_EVENTS.supportTicketCreated,
          }},
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      const inserted = ticketRows as Array<{ id: string }>;
      supportTicketId = inserted[0]?.id || null;
    } catch (ticketError) {
      console.error('Support ticket persistence failed:', ticketError);
    }

    if (resend) {
      // Send email to support team
      await resend.emails.send({
        from: 'RenkFlow <noreply@renkflow.com>',
        to: ['support@renkflow.com'],
        replyTo: email,
        subject: `[İletişim Formu] ${subjectText} - ${safeNameForSubject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #8c5e40;">Yeni İletişim Formu Mesajı</h2>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            
            <p><strong>Ticket ID:</strong> ${supportTicketId || '-'}</p>
            <p><strong>Ad Soyad:</strong> ${safeName}</p>
            <p><strong>E-posta:</strong> ${safeEmail}</p>
            <p><strong>Konu:</strong> ${safeSubject}</p>

            <h3 style="margin-top: 30px;">Bağlam</h3>
            <p><strong>Sayfa:</strong> ${safePagePath}</p>
            <p><strong>Dil:</strong> ${safeLocale}</p>
            <p><strong>Tenant:</strong> ${safeTenantId}</p>
            <p><strong>User:</strong> ${safeUserId}</p>
            <p><strong>User-Agent:</strong> ${safeUserAgent}</p>
            
            <h3 style="margin-top: 30px;">Mesaj:</h3>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; white-space: pre-wrap;">
              ${safeMessage}
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #888; font-size: 12px;">
              Bu mesaj RenkFlow iletişim formu üzerinden gönderilmiştir.
            </p>
          </div>
        `,
      });

      // Send confirmation email to user
      await resend.emails.send({
        from: 'RenkFlow <noreply@renkflow.com>',
        to: [email],
        subject: 'Mesajınız Alındı - RenkFlow',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #8c5e40;">Mesajınız İçin Teşekkürler!</h2>
            <p>Merhaba ${safeName},</p>
            <p>Mesajınızı aldık ve en kısa sürede size dönüş yapacağız.</p>
            
            <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Destek Kaydı:</strong> ${supportTicketId || '-'}</p>
              <p style="margin: 10px 0 0;"><strong>Konu:</strong> ${safeSubject}</p>
              <p style="margin: 10px 0 0;"><strong>Mesajınız:</strong></p>
              <p style="margin: 5px 0 0; color: #666;">${safeMessage}</p>
            </div>
            
            <p>İyi günler,<br />RenkFlow Ekibi</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #888; font-size: 12px;">
              Bu otomatik bir yanıttır, lütfen bu e-postaya yanıt vermeyiniz.
            </p>
          </div>
        `,
      });
    } else {
      console.warn('Resend API key is missing; support request persisted without email delivery');
    }

    return NextResponse.json(
      {
        success: true,
        ticketId: supportTicketId,
        message: 'Mesajınız başarıyla alındı!',
        emailDelivered: Boolean(resend),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Mesaj gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' },
      { status: 500 }
    );
  }
}
