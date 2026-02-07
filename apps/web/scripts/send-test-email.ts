
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Resend } from 'resend';

async function main() {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const templateId = '913fb132-455c-451b-bc13-3c910cb292e8'; // Waitlist Confirmation

  console.log(`Sending test email using Template ID: ${templateId}...`);
  
  try {
     // @ts-ignore - Check if template_id is supported in types or runtime
     const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: 'beratshn2007@gmail.com',
        subject: 'Test Template ID Support', 
        template_id: templateId,
     } as any);
     
     if (result.error) {
         console.error('❌ Failed to send:', result.error);
     } else {
         console.log('✅ Email sent successfully with Template ID!');
         console.log('ID:', result.data?.id);
     }
  } catch (err) {
      console.error('Exception:', err);
  }
}

main().catch(console.error);
