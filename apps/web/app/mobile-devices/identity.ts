import 'server-only';
import {auth} from '@/auth';
import {sql} from '@/lib/db';
import {isPrivateAccessAllowed} from '@/lib/features/auth/private-access';
import {redirect} from 'next/navigation';
export async function deviceOwner() {
 const session=await auth();if(!session?.user?.id||!session.user.tenantId||!isPrivateAccessAllowed(session.user.email)) redirect('/login');
 const [m]=await sql`SELECT to_jsonb(m)->>'deactivated_at' AS deactivated FROM tenant_members m WHERE m.user_id=${session.user.id} AND m.tenant_id=${session.user.tenantId}`;
 if(!m||m.deactivated) redirect('/login');
 const sid=(session as unknown as {sessionId?:string}).sessionId;
 if(sid) {const [active]=await sql`SELECT id FROM user_sessions WHERE id=${sid} AND user_id=${session.user.id} AND revoked_at IS NULL`;if(!active) redirect('/login');}
 return {userId:session.user.id,tenantId:session.user.tenantId};
}
