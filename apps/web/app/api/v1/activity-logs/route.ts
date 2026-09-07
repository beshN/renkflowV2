import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

// ============================================
// GET — Aktivite kayıtlarını listele
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    // Tenant ID al
    const memberRows = await sql`
      SELECT tenant_id FROM tenant_members
      WHERE user_id = ${session.user.id}
      ORDER BY created_at ASC LIMIT 1
    `;
    const tenantId = (memberRows[0] as any)?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant bulunamadı.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType ve entityId gereklidir.' }, { status: 400 });
    }

    const rows = await sql`
      SELECT
        al.id,
        al.action,
        al.actor_name,
        al.actor_id,
        al.note,
        al.changes,
        al.metadata,
        al.created_at,
        u.name AS actor_display_name
      FROM activity_logs al
      LEFT JOIN users u ON u.id = al.actor_id
      WHERE al.tenant_id = ${tenantId}
        AND al.entity_type = ${entityType}
        AND al.entity_id = ${entityId}
      ORDER BY al.created_at ASC
      LIMIT ${limit}
    `;

    const logs = rows.map((row: any) => ({
      id: row.id,
      action: row.action,
      actorName: row.actor_display_name || row.actor_name || 'Sistem',
      actorId: row.actor_id,
      note: row.note,
      changes: row.changes,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ logs, total: logs.length });
  } catch (error: any) {
    console.error('[ActivityLogs GET]', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// ============================================
// POST — Yeni not veya aktivite ekle
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    // Tenant ID + user name
    const memberRows = await sql`
      SELECT tm.tenant_id, u.name AS user_name
      FROM tenant_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.user_id = ${session.user.id}
      ORDER BY tm.created_at ASC LIMIT 1
    `;
    const tenantId = (memberRows[0] as any)?.tenant_id;
    const actorName = (memberRows[0] as any)?.user_name || session.user.name || session.user.email;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant bulunamadı.' }, { status: 403 });
    }

    const body = await req.json();
    const { entityType, entityId, action, note, changes, metadata } = body;

    if (!entityType || !entityId || !action) {
      return NextResponse.json({ error: 'entityType, entityId ve action gereklidir.' }, { status: 400 });
    }

    if (action === 'note_added' && (!note || !note.trim())) {
      return NextResponse.json({ error: 'Not içeriği boş olamaz.' }, { status: 400 });
    }

    if (note && note.length > 2000) {
      return NextResponse.json({ error: 'Not en fazla 2000 karakter olabilir.' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO activity_logs (
        tenant_id, entity_type, entity_id, action,
        actor_id, actor_name, note, changes, metadata
      ) VALUES (
        ${tenantId}, ${entityType}, ${entityId}, ${action},
        ${session.user.id}, ${actorName},
        ${note || null},
        ${changes ? JSON.stringify(changes) : '{}'}::jsonb,
        ${metadata ? JSON.stringify(metadata) : '{}'}::jsonb
      )
      RETURNING *
    `;

    return NextResponse.json({ log: rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('[ActivityLogs POST]', error);
    return NextResponse.json({ error: 'Not eklenemedi.' }, { status: 500 });
  }
}

// ============================================
// Utility — Server-side activity logging (import edilecek)
// ============================================

export async function logActivity({
  tenantId,
  entityType,
  entityId,
  action,
  actorId,
  actorName,
  note,
  changes,
  metadata,
  tx,
}: {
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  note?: string | null;
  changes?: Record<string, { from: string; to: string }> | null;
  metadata?: Record<string, unknown> | null;
  tx?: any;
}) {
  const db = tx || sql;
  await db`
    INSERT INTO activity_logs (
      tenant_id, entity_type, entity_id, action,
      actor_id, actor_name, note, changes, metadata
    ) VALUES (
      ${tenantId}, ${entityType}, ${entityId}, ${action},
      ${actorId || null}, ${actorName || null},
      ${note || null},
      ${changes ? JSON.stringify(changes) : '{}'}::jsonb,
      ${metadata ? JSON.stringify(metadata) : '{}'}::jsonb
    )
  `;
}
