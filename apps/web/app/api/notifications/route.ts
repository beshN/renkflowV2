import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerUserContext,AuthenticationError } from '@/lib/features/auth/serverAuth';
import { getUserNotifications,markAllNotificationsAsRead } from '@/lib/notifications/service';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
export const dynamic='force-dynamic';
function failure(error:unknown){return NextResponse.json({error:error instanceof AuthenticationError || error instanceof WorkOrderApiError?error.message:'Bildirim işlemi tamamlanamadı'},{status:error instanceof AuthenticationError?401:error instanceof WorkOrderApiError?error.status:error instanceof z.ZodError?400:503});}
export async function GET(request:NextRequest){try{
 const a=await getServerUserContext();
 const q=z.object({limit:z.coerce.number().int().min(1).max(100),offset:z.coerce.number().int().min(0).max(1000000)}).parse({limit:request.nextUrl.searchParams.get('limit') || 20,offset:request.nextUrl.searchParams.get('offset') || 0});
 return NextResponse.json({success:true,...await getUserNotifications(a.userId,a.tenantId,{...q,unreadOnly:request.nextUrl.searchParams.get('unread')==='true'})},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e);}}
export async function PATCH(request:NextRequest){try{const a=await getServerUserContext();requireSameOriginJson(request);await markAllNotificationsAsRead(a.userId,a.tenantId);return NextResponse.json({success:true});}catch(e){return failure(e);}}
