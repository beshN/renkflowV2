import { NextResponse } from 'next/server';
import { auth } from '@/auth';

import { sql } from '@/lib/db';
import { TEMPLATE_BY_KEY, DEFAULT_TEMPLATE_KEY, TemplateKey } from '@/lib/config/templates';

export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, name, brandColor, logoUrl, industry, templateKey } = await request.json();

    // Verify user has permission to update this tenant
    const members = await sql`
      SELECT role FROM tenant_members
      WHERE tenant_id = ${tenantId} AND user_id = ${session.user.id}
      LIMIT 1
    `;

    const membersRows = members as any[];
    if (membersRows.length === 0 || !['owner', 'admin'].includes(membersRows[0].role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Şirket adı en az 2 karakter olmalıdır' }, { status: 400 });
    }

    // Validate Hex Color
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (brandColor && !hexColorRegex.test(brandColor)) {
      return NextResponse.json({ error: 'Geçersiz renk kodu' }, { status: 400 });
    }

    // Validate URL (if provided)
    if (logoUrl && typeof logoUrl === 'string') {
      try {
        new URL(logoUrl);
      } catch {
        return NextResponse.json({ error: 'Geçersiz logo URL' }, { status: 400 });
      }
    }

    const normalizedTemplate = TEMPLATE_BY_KEY[(templateKey as TemplateKey) || DEFAULT_TEMPLATE_KEY];
    const normalizedIndustry = industry || normalizedTemplate.industry;

    // Update tenant
    await sql`
      UPDATE tenants
      SET 
        name = ${name.trim()}, 
        brand_color = ${brandColor || null}, 
        logo_url = ${logoUrl || null},
        industry = ${normalizedIndustry || null},
        template_key = ${normalizedTemplate?.key || null},
        updated_at = NOW()
      WHERE id = ${tenantId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Update tenant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
