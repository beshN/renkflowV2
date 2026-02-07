// ============================================
// SSE NOTIFICATIONS STREAM API ROUTE
// ============================================

import { NextRequest } from 'next/server';
import { sseConnectionManager } from '@/lib/realtime/sse';
import { verifyAccessToken, cookieConfig } from '@/lib/auth/jwt';

// ============================================
// GET /api/notifications/stream
// ============================================

export async function GET(request: NextRequest) {
  // SECURITY: Get userId from authenticated token, NOT from query params
  const accessToken = request.cookies.get(cookieConfig.accessToken.name)?.value;
  
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const payload = await verifyAccessToken(accessToken);
  
  if (!payload) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const userId = payload.userId;

  // Create readable stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  // Add connection
  const connectionId = crypto.randomUUID();
  const connection = sseConnectionManager.addConnection(connectionId, userId, writer);

  // Send initial connection event
  const initMessage = `id: ${crypto.randomUUID()}\nevent: connected\ndata: ${JSON.stringify({ connectionId, userId })}\n\n`;
  writer.write(encoder.encode(initMessage));

  // Handle client disconnect
  request.signal.addEventListener('abort', () => {
    sseConnectionManager.removeConnection(connectionId);
  });

  // Keep alive ping
  const pingInterval = setInterval(() => {
    try {
      const pingMessage = `: ping\n\n`;
      writer.write(encoder.encode(pingMessage));
    } catch {
      clearInterval(pingInterval);
      sseConnectionManager.removeConnection(connectionId);
    }
  }, 30000);

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// ============================================
// POST /api/notifications/stream - Send notification
// ============================================

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify sender is authenticated and has permission
    const accessToken = request.cookies.get(cookieConfig.accessToken.name)?.value;
    
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const senderPayload = await verifyAccessToken(accessToken);
    
    if (!senderPayload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Only admins can send notifications to other users
    if (senderPayload.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden', code: 'FORBIDDEN' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { userId, type, title, body: messageBody, actionUrl } = body;

    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: 'userId and title required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const notification = {
      id: crypto.randomUUID(),
      type: type ?? 'info',
      title,
      body: messageBody ?? '',
      actionUrl,
      timestamp: new Date().toISOString(),
    };

    // Send to user
    sseConnectionManager.sendToUser(userId, 'notification', notification);

    return new Response(
      JSON.stringify({ success: true, notification }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
