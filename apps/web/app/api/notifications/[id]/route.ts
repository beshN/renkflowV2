import { NextRequest,NextResponse } from 'next/server';
import { getServerUserContext,AuthenticationError } from '@/lib/features/auth/serverAuth';
import { markNotificationAsRead,deleteNotification } from '@/lib/notifications/service';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
async function change(request:NextRequest,params:Promise<{id:string}>,remove:boolean){try{const a=await getServerUserContext();requireSameOriginJson(request);const {id}=await params;if(!id || id.length>180)throw new WorkOrderApiError('Geçersiz bildirim',400);if(remove)await deleteNotification(id,a.userId,a.tenantId);else await markNotificationAsRead(id,a.userId,a.tenantId);return NextResponse.json({success:true});}catch(e){return NextResponse.json({error:e instanceof AuthenticationError || e instanceof WorkOrderApiError?e.message:'Bildirim güncellenemedi'},{status:e instanceof AuthenticationError?401:e instanceof WorkOrderApiError?e.status:503});}}
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){return change(request,params,false);}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){return change(request,params,true);}
