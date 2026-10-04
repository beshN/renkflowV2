import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { sql } from '@/lib/db';
import { requireWorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { requireProcurementRead } from '@/lib/features/manufacturing/purchasing.service';
import { productionCommand } from '@/lib/features/manufacturing/platform.service';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
function failure(e:unknown) { return NextResponse.json({ error:e instanceof WorkOrderApiError ? e.message : e instanceof ZodError ? 'Tedarikçi bilgilerini kontrol edin' : 'Tedarikçi kaydedilemedi; aynı adla kayıt bulunabilir.' },{status:e instanceof WorkOrderApiError ? e.status : e instanceof ZodError ? 400 : 409}); }
export async function GET() {
  try { const actor=await requireWorkOrderActor();requireProcurementRead(actor);return NextResponse.json({success:true,data:await sql`SELECT * FROM suppliers WHERE tenant_id=${actor.tenantId} ORDER BY name`},{headers:{'Cache-Control':'no-store'}}); }
  catch(e) {return failure(e);}
}
export async function POST(req:NextRequest) {
  try {requireSameOriginJson(req,20000);const actor=await requireWorkOrderActor();const {commandId,...data}=await req.json();return NextResponse.json({success:true,data:await productionCommand(actor,{commandId:commandId || randomUUID(),action:'procurement.supplier.save',data})},{status:201});}
  catch(e) {return failure(e);}
}
