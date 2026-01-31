import { NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    // Test email sending
    const testEmail = 'test@example.com'; // Değiştir: gerçek email adresi koy
    const testName = 'Test User';
    const testUrl = 'http://localhost:3000/auth/verify?token=test123';

    console.log('🔍 Testing email configuration...');
    console.log('📧 Attempting to send to:', testEmail);

    const result = await sendVerificationEmail(testEmail, testName, testUrl);

    console.log('📬 Email send result:', result);

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Email sent successfully!',
        data: result.data 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error,
        message: 'Email failed to send. Check logs above.' 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('❌ Test email error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Email test failed'
    }, { status: 500 });
  }
}
