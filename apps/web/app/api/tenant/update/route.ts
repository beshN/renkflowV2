import { changedFields, recordAuditAfterCommit } from '@/lib/audit/audit-log';
import { NextResponse } from 'next/server';

import { sql } from '@/lib/db';
import { z } from 'zod';
import { TEMPLATE_BY_KEY, TemplateKey } from '@/lib/config/templates';
import { AuthenticationError, AuthorizationError, assertTenantAccess, requireTenantContext } from '@/lib/auth/serverAuth';

const UpdateTenantSchema = z.object({
  tenantId: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'Şirket adı en az 2 karakter olmalıdır').max(120).optional(),
  brandColor: z.union([z.literal(''), z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Geçersiz renk kodu')]).optional(),
  logoUrl: z.union([z.literal(''), z.string().max(2000).url('Geçersiz logo URL')]).optional(),
  templateKey: z.string().refine((key) => key in TEMPLATE_BY_KEY, 'Geçersiz üretim alanı').optional(),
  industry: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const context = await requireTenantContext();

    const input = UpdateTenantSchema.parse(await request.json());
    const effectiveTenantId = context.tenantId;
    if (input.tenantId) {
      assertTenantAccess(context, input.tenantId, 'Forbidden');
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

    // Only the fields the client sent are written: saving the name must not reset the template or industry.
    const updates: Record<string, string | null> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.brandColor !== undefined) updates.brand_color = input.brandColor || null;
    if (input.logoUrl !== undefined) updates.logo_url = input.logoUrl || null;
    if (input.templateKey !== undefined) updates.template_key = input.templateKey;
    if (input.industry !== undefined) updates.industry = input.industry || null;
    else if (input.templateKey !== undefined) updates.industry = TEMPLATE_BY_KEY[input.templateKey as TemplateKey].industry;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan bulunamadı' }, { status: 400 });
    }

    const [before] = await sql`SELECT name, brand_color, logo_url, industry, template_key FROM tenants WHERE id = ${effectiveTenantId}`;
    const setFragment = Object.entries(updates)
      .map(([column, value]) => sql`${sql(column)} = ${value}`)
      .reduce((acc, curr) => sql`${acc}, ${curr}`);

    const updated = await sql`
      UPDATE tenants
      SET ${setFragment}, updated_at = NOW()
      WHERE id = ${effectiveTenantId}
      RETURNING id
    `;
    const updatedRows = updated as Array<{ id: string }>;
    if (updatedRows.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    const changes = changedFields(before || {}, updates);
    if (Object.keys(changes).length) {
      await recordAuditAfterCommit({ tenantId: effectiveTenantId, actorId: context.userId, entityType: 'tenant', entityId: effectiveTenantId, action: 'settings_updated', changes });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Geçersiz firma bilgisi' }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
    }
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
