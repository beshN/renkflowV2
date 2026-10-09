import { isPrivateAccessAllowed } from './private-access';
import type { JWT } from "next-auth/jwt";
import { getSql } from "@/lib/db";
import { resolveMemberAccess, sessionRevoked } from "@/lib/security/member-access.server";

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
  // A deactivated member, or a sign-in closed from the sessions screen (or by "sign out everywhere"), ends here.
  // Read through the short cache: this runs on every auth() call; the data guards
  // (requireWorkOrderActor, getServerUserContext) re-read the membership fresh.
  const access = await resolveMemberAccess(identity.id, identity.tenant_id, { cached: true });
  if (!access || access.deactivated) return null;
  if (await sessionRevoked(identity.id, typeof token.sid === "string" ? token.sid : null, typeof token.iat === "number" ? token.iat : null, { cached: true })) return null;
  if (typeof token.sid === "string") await touchSession(token.sid);
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

const touched = new Map<string, number>();
/** Marks the session as seen (at most every 5 minutes per session, so requests do not each write). */
async function touchSession(sid: string) {
  const last = touched.get(sid) ?? 0;
  if (Date.now() - last < 300_000) return;
  touched.set(sid, Date.now());
  if (touched.size > 20_000) touched.clear();
  try {
    await getSql()`UPDATE user_sessions SET last_seen_at = now() WHERE id = ${sid} AND revoked_at IS NULL`;
  } catch {
    /* the table may not exist before migration 044 */
  }
}

/** A new sign-in gets its own session row (shown on the sessions screen, closable one by one). */
export async function openSession(userId: string, tenantId: string | null | undefined): Promise<string | null> {
  try {
    const sid = crypto.randomUUID();
    let agent: string | null = null;
    try {
      const { headers } = await import('next/headers');
      agent = (await headers()).get('user-agent')?.slice(0, 300) ?? null;
    } catch {
      agent = null; // outside a request (tests, scripts)
    }
    await getSql()`INSERT INTO user_sessions (id, user_id, tenant_id, user_agent) VALUES (${sid}, ${userId}, ${tenantId ?? null}, ${agent})`;
    return sid;
  } catch {
    return null; // before migration 044 sessions are not tracked
  }
}
