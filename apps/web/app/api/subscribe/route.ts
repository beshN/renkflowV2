import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db/neon';
import { sendWaitlistEmail } from '@/lib/email';
import { authRateLimiter, apiRateLimiter, RateLimiter } from '@/lib/rateLimiter';

// Create a dedicated rate limiter for newsletter subscriptions
const subscribeRateLimiter = new RateLimiter({
  windowMs: 3600000, // 1 hour
  maxAttempts: 5,
  blockDurationMs: 3600000,
  keyPrefix: 'subscribe:',
});

const subscribeSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const rateLimit = await subscribeRateLimiter.check(request, 'subscribe');
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    // Zod validation
    const result = subscribeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = result.data;

    try {
      await sql`
        INSERT INTO newsletter_subscribers (email)
        VALUES (${email})
      `;
      
      // Send welcome email (await result to debug)
      const emailResult = await sendWaitlistEmail(email);
      
      if (!emailResult.success) {
        console.error('Email send failed:', emailResult.error);
        return NextResponse.json({ 
          message: 'Kayıt başarılı ancak e-posta gönderilemedi.',
          isPartialSuccess: true
        }, { status: 200 });
      }

    } catch (dbError) {
      if (typeof dbError === 'object' && dbError !== null && 'code' in dbError && dbError.code === '23505') {
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
