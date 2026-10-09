/**
 * Internal API for Admin Notifications
 * 
 * Sends email notifications to admins for critical errors
 * This endpoint is internal-only and should not be exposed publicly
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sendEmail } from '@/lib/email';

/** Constant-time check of the internal secret; without a configured secret nothing is accepted. */
function internalAuthorized(header: string | null) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    // Fails closed: an unset secret used to leave this e-mail relay open.
    if (!internalAuthorized(request.headers.get('x-internal-secret'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
