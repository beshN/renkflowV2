/**
 * Internal API for Admin Notifications
 * 
 * Sends email notifications to admins for critical errors
 * This endpoint is internal-only and should not be exposed publicly
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

// Only allow internal requests
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify internal request
    const authHeader = request.headers.get('x-internal-secret');
    if (INTERNAL_SECRET && authHeader !== INTERNAL_SECRET) {
      // Allow requests from same origin in development
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      );
    }

    // Send email
    await sendEmail({
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AdminNotification] Failed to send:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
