import { Resend } from 'resend';

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Email sender addresses for different purposes
const getUpdatesEmail = () => 
  process.env.RESEND_UPDATES_EMAIL || process.env.EMAIL_FROM || 'RenkFlow <updates@renkflow.com>';

const getSupportEmail = () => 
  process.env.RESEND_SUPPORT_EMAIL || process.env.EMAIL_FROM || 'RenkFlow <support@renkflow.com>';

const getInfoEmail = () => 
  process.env.RESEND_INFO_EMAIL || process.env.EMAIL_FROM || 'RenkFlow <info@renkflow.com>';

/**
 * Generic send email function
 */
export async function sendEmail({
  to,
  subject,
  html,
  from,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  if (!resend) {
    console.warn('Resend is not configured. Email not sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: from || getSupportEmail(),
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Email send error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email send exception:', error);
    return { success: false, error };
  }
}

export async function sendVerificationEmail(
  email: string,
  userName: string,
  verificationUrl: string
) {
  if (!resend) {
    console.warn('Resend is not configured. Verification email not sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    // @ts-ignore - Resend Managed Templates usage
    const { data, error } = await resend.emails.send({
      from: getUpdatesEmail(),
      to: [email],
      subject: 'Renkflow Hesabınızı Doğrulayın',
      template: {
        id: 'verify-email',
        variables: {
          userName,
          confirmationLink: verificationUrl,
        },
      },
    });

    if (error) {
      console.error('Verification email error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email send exception:', error);
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetUrl: string
) {
  if (!resend) {
    console.warn('Resend is not configured. Password reset email not sent.');
    console.log('[EMAIL] Password reset URL for', email, ':', resetUrl);
    return { success: false, error: 'Email service not configured' };
  }

  // Fallback HTML template
  const fallbackHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Şifre Sıfırlama</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://renkflow.com/email-assets/header-logo.png" alt="RenkFlow" width="222" height="44" style="display:block;margin:0 auto;" />
      </div>
      <h2 style="color: #1e293b;">Merhaba ${userName}!</h2>
      <p style="color: #64748b; line-height: 1.6;">
        Hesabınız için bir şifre sıfırlama talebi aldık. Şifrenizi sıfırlamak için aşağıdaki butona tıklayın.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #b87444, #3b8f6f); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Şifremi Sıfırla
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 14px;">
        Veya bu linki tarayıcınıza yapıştırın:<br>
        <a href="${resetUrl}" style="color: #b87444;">${resetUrl}</a>
      </p>
      <p style="color: #ef4444; font-size: 14px; margin-top: 20px;">
        ⚠️ Bu link 1 saat içinde geçerliliğini yitirecektir.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        Bu talebi siz yapmadıysanız, bu e-postayı güvenle görmezden gelebilirsiniz.
        Hesabınız güvende kalacaktır.
      </p>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: getSupportEmail(),
      to: [email],
      subject: 'RenkFlow Şifre Sıfırlama Talebi',
      html: fallbackHtml,
    });

    if (error) {
      console.error('Password reset email error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Password reset email exception:', error);
    return { success: false, error };
  }
}

export async function sendWaitlistEmail(email: string) {
  if (!resend) {
    console.warn('Resend is not configured. Waitlist email not sent.');
    return { success: false, error: 'Email service not configured' };
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Bekleme Listesi</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://renkflow.com/email-assets/header-logo.png" alt="RenkFlow" width="222" height="44" style="display:block;margin:0 auto;" />
      </div>
      <h2 style="color: #1e293b;">Bekleme Listesine Hoş Geldiniz!</h2>
      <p style="color: #64748b; line-height: 1.6;">
        RenkFlow bekleme listesine kaydınız başarıyla alındı. Lansman zamanı geldiğinde size haber vereceğiz.
      </p>
      <p style="color: #64748b; line-height: 1.6;">
        Erken erişim için bizi takipte kalın!
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        © 2024 RenkFlow. Tüm hakları saklıdır.
      </p>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: getUpdatesEmail(),
      to: [email],
      subject: 'RenkFlow Bekleme Listesine Hoş Geldiniz!',
      html,
    });

    if (error) {
      console.error('Waitlist email error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Waitlist email exception:', error);
    return { success: false, error };
  }
}

/**
 * Send Invite Email (New)
 */
export async function sendInviteEmail(
  email: string,
  inviteLink: string,
  role: string
) {
  if (!resend) {
    console.warn('Resend is not configured. Invite email not sent.');
    return { success: false, error: 'Email service not configured' };
  }

  const roleText = role === 'admin' ? 'Yönetici' : role === 'member' ? 'Üye' : role;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Davet</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://renkflow.com/email-assets/header-logo.png" alt="RenkFlow" width="222" height="44" style="display:block;margin:0 auto;" />
      </div>
      <h2 style="color: #1e293b;">Bir Davet Aldınız!</h2>
      <p style="color: #64748b; line-height: 1.6;">
        Bir RenkFlow ekibine <strong>${roleText}</strong> olarak davet edildiniz.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #b87444, #3b8f6f); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Daveti Kabul Et
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 14px;">
        Veya bu linki tarayıcınıza yapıştırın:<br>
        <a href="${inviteLink}" style="color: #b87444;">${inviteLink}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        Bu daveti beklemiyorsanız, bu e-postayı güvenle görmezden gelebilirsiniz.
      </p>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: getUpdatesEmail(),
      to: [email],
      subject: 'Bir RenkFlow Daveti Aldınız!',
      html,
    });

    if (error) {
      console.error('Invite email error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Invite email exception:', error);
    return { success: false, error };
  }
}
