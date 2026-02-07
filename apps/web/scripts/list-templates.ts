
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Resend } from 'resend';

async function main() {
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  try {
    const { data } = await resend.templates.list();
    console.log('Found templates:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error listing templates:', error);
  }
}

main();
