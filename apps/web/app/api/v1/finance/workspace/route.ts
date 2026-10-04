import { z } from "zod";
import { NextRequest,NextResponse } from 'next/server';
import { requireWorkOrderActor,WorkOrderApiError } from '@/lib/features/work-orders/security';
import { financeWorkspace } from '@/lib/features/finance/workspace.service';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const employeeId=z.string().uuid().optional().parse(req.nextUrl.searchParams.get("employeeId") || undefined);return NextResponse.json({data:await financeWorkspace(await requireWorkOrderActor(),employeeId)},{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:e instanceof WorkOrderApiError?e.message:'Finans kayıtları alınamadı'},{status:e instanceof WorkOrderApiError?e.status:503});}}
