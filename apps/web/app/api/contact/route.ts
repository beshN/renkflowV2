import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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

export async function POST(request: Request) {
  try {
    const { name, email, subject, message } = await request.json();

    if (!resend) {
      console.error('Resend API key is missing');
      return NextResponse.json(
        { error: 'E-posta servisi yapılandırılmamış.' },
        { status: 503 }
      );
    }

    // Validate input
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Ad, e-posta ve mesaj alanları zorunludur.' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Geçerli bir e-posta adresi girin.' },
        { status: 400 }
      );
    }

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

    // Send email to support team
    await resend.emails.send({
      from: 'RenkFlow <noreply@renkflow.com>',
      to: ['support@renkflow.com'],
      replyTo: email,
      subject: `[İletişim Formu] ${subjectText} - ${safeNameForSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4361ee;">Yeni İletişim Formu Mesajı</h2>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          
          <p><strong>Ad Soyad:</strong> ${safeName}</p>
          <p><strong>E-posta:</strong> ${safeEmail}</p>
          <p><strong>Konu:</strong> ${safeSubject}</p>
          
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
          <h2 style="color: #4361ee;">Mesajınız İçin Teşekkürler!</h2>
          <p>Merhaba ${safeName},</p>
          <p>Mesajınızı aldık ve en kısa sürede size dönüş yapacağız.</p>
          
          <div style="background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Konu:</strong> ${safeSubject}</p>
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

    return NextResponse.json(
      { success: true, message: 'Mesajınız başarıyla gönderildi!' },
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
