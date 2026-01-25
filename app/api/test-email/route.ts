import { NextResponse } from 'next/server';
import { sendVerificationEmail } from '@/lib/email';

export async function GET() {
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
      return Response.json({ 
        success: true, 
        message: 'Email sent successfully!',
        data: result.data 
      });
    } else {
      return Response.json({ 
        success: false, 
        error: result.error,
        message: 'Email failed to send. Check logs above.' 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('❌ Test email error:', error);
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
