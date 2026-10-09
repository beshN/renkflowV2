import { redactedJson } from '@/lib/security/field-access.server';
import { z } from "zod";
import { NextRequest } from 'next/server';
import { requireWorkOrderActor,WorkOrderApiError } from '@/lib/features/work-orders/security';
import { financeWorkspace } from '@/lib/features/finance/workspace.service';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const employeeId=z.string().uuid().optional().parse(req.nextUrl.searchParams.get("employeeId") || undefined);return redactedJson({data:await financeWorkspace(await requireWorkOrderActor(),employeeId)},{headers:{'Cache-Control':'no-store'}});}catch(e){return redactedJson({error:e instanceof WorkOrderApiError?e.message:'Finans kayıtları alınamadı'},{status:e instanceof WorkOrderApiError?e.status:503});}}
