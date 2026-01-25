
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Resend } from 'resend';
import { render } from '@react-email/components';
import WaitlistConfirmationEmail from '../emails/waitlist-confirmation';
import VerifyEmail from '../emails/verify-email';
import PasswordResetEmail from '../emails/password-reset';

const resend = new Resend(process.env.RESEND_API_KEY);

async function syncTemplates() {
  const templates = [
    {
      name: 'Waitlist Confirmation',
      alias: 'waitlist-confirmation',
      subject: 'Renkflow Bekleme Listesine Hoş Geldiniz!',
      component: WaitlistConfirmationEmail(),
    },
    {
      name: 'Verify Email',
      alias: 'verify-email',
      subject: 'Renkflow Hesabınızı Doğrulayın',
      component: VerifyEmail({ userName: '{{name}}', verificationUrl: '{{url}}' }),
    },
    {
      name: 'Password Reset',
      alias: 'password-reset',
      subject: 'Renkflow Şifre Sıfırlama Talebi',
      component: PasswordResetEmail({ userName: '{{name}}', resetUrl: '{{url}}' }),
    },
  ];

  for (const t of templates) {
    try {
      console.log(`Rendering ${t.name}...`);
      const html = await render(t.component);

      console.log(`Uploading ${t.name} to Resend...`);
      
      // Check if template exists first (optional complexity, for now just create and catch error if duplicate name, or just use create always if allows)
      // Resend API documentation says create returns the created template.
      // If we want to "update", we might need to get ID first or Delete then Create.
      // For simplicity in this first run, let's try to Create.
      
      await resend.templates.create({
        name: t.name,
        html: html,
        subject: t.subject,
      });
      
      console.log(`✅ ${t.name} created successfully.`);
    } catch (error: any) {
      console.error(`❌ Error syncing ${t.name}:`, error.message || error);
    }
  }
}

syncTemplates().catch(console.error);
