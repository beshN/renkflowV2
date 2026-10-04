import { isPrivateAccessAllowed } from './private-access';
import type { JWT } from "next-auth/jwt";
import { getSql } from "@/lib/db";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the signed identity selects a membership. Client session updates never select an actor. */
export async function refreshSessionIdentity(token: JWT): Promise<JWT | null> {
  if (
    typeof token.id !== "string" ||
    !uuid.test(token.id) ||
    typeof token.tenantId !== "string" ||
    !uuid.test(token.tenantId)
  )
    return null;
  const sql = getSql();
  const [identity] = await sql`
    SELECT u.id,u.name,u.email,u.image,m.role,t.id AS tenant_id,t.name AS tenant_name,
      t.brand_color,t.logo_url,t.industry,t.template_key
    FROM users u JOIN tenant_members m ON m.user_id=u.id JOIN tenants t ON t.id=m.tenant_id
    WHERE u.id=${token.id} AND m.tenant_id=${token.tenantId} LIMIT 1
  `;
  if (!identity || !isPrivateAccessAllowed(identity.email)) return null;
  return {
    ...token,
    id: identity.id,
    sub: identity.id,
    name: identity.name,
    email: identity.email,
    picture: identity.image,
    tenantId: identity.tenant_id,
    tenantName: identity.tenant_name,
    role: identity.role,
    brandColor: identity.brand_color,
    logoUrl: identity.logo_url,
    tenantIndustry: identity.industry,
    templateKey: identity.template_key,
  };
}
