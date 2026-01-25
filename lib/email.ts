import { Resend } from 'resend';
import VerifyEmail from '@/emails/verify-email';
import PasswordResetEmail from '@/emails/password-reset';
import WaitlistConfirmationEmail from '@/emails/waitlist-confirmation';

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Get the from email address - use custom domain in production if configured
const getFromEmail = () => {
  const customDomain = process.env.RESEND_FROM_EMAIL;
  if (customDomain) {
    return customDomain;
  }
  return 'Renkflow <onboarding@resend.dev>';
};

export async function sendVerificationEmail(
  email: string,
  userName: string,
  verificationUrl: string
) {
  // If Resend is not configured, log warning and return
  if (!resend) {
    console.warn('Resend is not configured. Verification email not sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
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
  // If Resend is not configured, log warning and return
  if (!resend) {
    console.warn('Resend is not configured. Password reset email not sent.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [email],
      subject: 'Renkflow Şifre Sıfırlama Talebi',
      react: PasswordResetEmail({ userName, resetUrl }),
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

  try {
      const { data, error } = await resend.emails.send({
          from: getFromEmail(),
          to: [email],
          subject: 'Renkflow Bekleme Listesine Hoş Geldiniz!',
          react: WaitlistConfirmationEmail(),
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
