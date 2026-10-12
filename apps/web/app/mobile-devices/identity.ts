import 'server-only';
import { getServerUserContext, AuthenticationError } from '@/lib/features/auth/serverAuth';
import { isPrivateAccessAllowed } from '@/lib/features/auth/private-access';
import { redirect } from 'next/navigation';

/** Each action rechecks its own authenticated membership; form fields never choose an owner. */
export async function deviceOwner() {
  try {
    const context=await getServerUserContext();
    if(!isPrivateAccessAllowed(context.email)) redirect('/auth/login');
    return {userId:context.userId,tenantId:context.tenantId};
  } catch(error) {
    if(error instanceof AuthenticationError) redirect('/auth/login');
    throw error;
  }
}
