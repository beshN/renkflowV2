import { Resend } from 'resend';
import VerifyEmail from '@/emails/verify-email';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  email: string,
  userName: string,
  verificationUrl: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Renkflow <onboarding@yourdomain.com>',
      to: [email],
      subject: 'Renkflow Hesabınızı Doğrulayın',
      react: VerifyEmail({ userName, verificationUrl }),
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

export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetUrl: string
) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Renkflow <noreply@yourdomain.com>',
      to: [email],
      subject: 'Şifre Sıfırlama Talebi',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Merhaba ${userName},</h2>
          <p>Şifrenizi sıfırlamak için aşağıdaki linke tıklayın:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
            Şifremi Sıfırla
          </a>
          <p>Bu link 1 saat içinde geçerliliğini yitirecektir.</p>
          <p style="color: #666; font-size: 12px;">Bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
        </div>
      `,
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
