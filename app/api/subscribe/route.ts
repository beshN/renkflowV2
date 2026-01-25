import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/neon';
import { sendWaitlistEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return NextResponse.json({ error: 'Geçersiz e-posta adresi.' }, { status: 400 });
    }

    try {
      await sql`
        INSERT INTO newsletter_subscribers (email)
        VALUES (${email})
      `;
      
      // Send welcome email (await result to debug)
      const emailResult = await sendWaitlistEmail(email);
      
      if (!emailResult.success) {
        console.error('Email send failed:', emailResult.error);
        // Return success for DB but warning for email to help debug
        return NextResponse.json({ 
          message: 'Kayıt başarılı ancak e-posta gönderilemedi: ' + (emailResult.error as any)?.message || 'Bilinmeyen hata',
          isPartialSuccess: true
        }, { status: 200 });
      }

    } catch (dbError: any) {
      if (dbError.code === '23505') { // Unique violation
        return NextResponse.json({ message: 'Zaten listeye kayıtlısınız!' }, { status: 200 });
      }
      throw dbError;
    }

    return NextResponse.json({ message: 'Başarıyla kayıt oldunuz ve e-posta gönderildi!' }, { status: 200 });
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json({ error: 'Bir hata oluştu. Lütfen tekrar deneyin.' }, { status: 500 });
  }
}
export const runtime = 'edge';
