import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { auth } from '@/auth';

import { sql } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, name, brandColor, logoUrl } = await request.json();

    // Verify user has permission to update this tenant
    const members = await sql`
      SELECT role FROM tenant_members
      WHERE tenant_id = ${tenantId} AND user_id = ${session.user.id}
      LIMIT 1
    `;

    if (members.length === 0 || !['owner', 'admin'].includes(members[0].role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update tenant
    await sql`
      UPDATE tenants
      SET name = ${name}, brand_color = ${brandColor}, logo_url = ${logoUrl}, updated_at = NOW()
      WHERE id = ${tenantId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update tenant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
export const runtime = 'edge';
