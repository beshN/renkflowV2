import { Resend } from 'resend';

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Email sender addresses for different purposes
const getUpdatesEmail = () => 
  process.env.RESEND_UPDATES_EMAIL || 'RenkFlow <updates@renkflow.com>';

const getSupportEmail = () => 
  process.env.RESEND_SUPPORT_EMAIL || 'RenkFlow <support@renkflow.com>';

const getInfoEmail = () => 
  process.env.RESEND_INFO_EMAIL || 'RenkFlow <info@renkflow.com>';

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
    return { success: false, error: 'Email service not configured' };
  }

  try {
    // @ts-ignore - Resend Managed Templates usage
    const { data, error } = await resend.emails.send({
      from: getSupportEmail(),
      to: [email],
      subject: 'Renkflow Şifre Sıfırlama Talebi',
      template: {
        id: 'password-reset',
        variables: {
          userName,
          resetLink: resetUrl,
        },
      },
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
    // @ts-ignore - Resend Managed Templates usage
    const { data, error } = await resend.emails.send({
      from: getUpdatesEmail(),
      to: [email],
      subject: 'Renkflow Bekleme Listesine Hoş Geldiniz!',
      template: {
        id: 'waitlist-confirmation',
        variables: {},
      },
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
    return { success: false, error: 'Email service not configured' };
  }

  try {
    // @ts-ignore
    const { data, error } = await resend.emails.send({
      from: getUpdatesEmail(),
      to: [email],
      subject: 'Bir RenkFlow Daveti Aldınız!',
      template: {
        id: 'invite-user',
        variables: {
          inviteLink,
          role,
        },
      },
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
