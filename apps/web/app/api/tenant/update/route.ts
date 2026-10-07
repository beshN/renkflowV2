import { changedFields, recordAuditAfterCommit } from '@/lib/audit/audit-log';
import { NextResponse } from 'next/server';

import { sql } from '@/lib/db';
import { TEMPLATE_BY_KEY, DEFAULT_TEMPLATE_KEY, TemplateKey } from '@/lib/config/templates';
import { AuthenticationError, AuthorizationError, assertTenantAccess, requireTenantContext } from '@/lib/auth/serverAuth';

export async function POST(request: Request) {
  try {
    const context = await requireTenantContext();

    const { tenantId, name, brandColor, logoUrl, industry, templateKey } = await request.json();
    const effectiveTenantId = context.tenantId;
    if (tenantId) {
      assertTenantAccess(context, tenantId, 'Forbidden');
    }

    // Verify user has permission to update this tenant
    const members = await sql`
      SELECT role FROM tenant_members
      WHERE tenant_id = ${effectiveTenantId} AND user_id = ${context.userId}
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

    const [before] = await sql`SELECT name, brand_color, logo_url, industry, template_key FROM tenants WHERE id = ${effectiveTenantId}`;

    // Update tenant
    const updated = await sql`
      UPDATE tenants
      SET 
        name = ${name.trim()}, 
        brand_color = ${brandColor || null}, 
        logo_url = ${logoUrl || null},
        industry = ${normalizedIndustry || null},
        template_key = ${normalizedTemplate?.key || null},
        updated_at = NOW()
      WHERE id = ${effectiveTenantId}
      RETURNING id
    `;
    const updatedRows = updated as Array<{ id: string }>;
    if (updatedRows.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    const changes = changedFields(before || {}, {
      name: name.trim(),
      brand_color: brandColor || null,
      logo_url: logoUrl || null,
      industry: normalizedIndustry || null,
      template_key: normalizedTemplate?.key || null,
    });
    if (Object.keys(changes).length) {
      await recordAuditAfterCommit({ tenantId: effectiveTenantId, actorId: context.userId, entityType: 'tenant', entityId: effectiveTenantId, action: 'settings_updated', changes });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Update tenant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
