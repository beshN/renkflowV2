/** @jest-environment node */
jest.mock('server-only',()=>({}));
jest.mock('@/auth',()=>({auth:jest.fn()}));
jest.mock('@/lib/db',()=>({sql:jest.fn(async()=>[])}));
jest.mock('@/lib/api/auth-helpers',()=>({getAPIUser:jest.fn(async()=>({id:'u',tenantId:'t',role:'office'})),errorResponse:(error:string,status:number)=>Response.json({error},{status})}));
jest.mock('@/lib/security/field-access.server',()=>({redactedSuccess:(data:unknown)=>Response.json({data})}));
jest.mock('@/lib/audit/audit-log',()=>({recordAuditAfterCommit:jest.fn()}));
jest.mock('@/lib/features/quotations/service',()=>({quotationService:{updateQuotation:jest.fn(async()=>({id:'q',version:2})),updateStatus:jest.fn(async()=>({id:'q',version:2}))}}));
import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/v1/quotations/[id]/route';
import { quotationService } from '@/lib/features/quotations/service';
import { defaultVisualization } from '@/lib/features/product-3d/catalog';

const request=(body:unknown)=>new NextRequest('http://x/api/v1/quotations/q',{method:'PATCH',headers:{'Content-Type':'application/json',Origin:'http://x'},body:JSON.stringify(body)});
test('editing a loaded quote with its status still updates lines and retains the 3D image',async()=>{
  const visual={configuration:defaultVisualization('pergola'),image:'data:image/jpeg;base64,dGVzdA=='};
  const response=await PATCH(request({status:'draft',expectedVersion:1,customerName:'Local customer',currency:'TRY',items:[{productName:'Pergola',quantity:1,unitPrice:500,discountPercent:0,totalPrice:500,productVisualization:visual}]}),{params:Promise.resolve({id:'q'})});
  expect(response.status).toBe(200);expect(quotationService.updateStatus).not.toHaveBeenCalled();
  expect(quotationService.updateQuotation).toHaveBeenCalledWith('t','q',expect.objectContaining({items:[expect.objectContaining({productVisualization:visual})]}));
});
test('an explicit status command keeps the existing transition flow',async()=>{
  const response=await PATCH(request({status:'sent',expectedVersion:1}),{params:Promise.resolve({id:'q'})});
  expect(response.status).toBe(200);expect(quotationService.updateQuotation).not.toHaveBeenCalled();
  expect(quotationService.updateStatus).toHaveBeenCalledWith('t','q','sent',1,'u','office');
});
