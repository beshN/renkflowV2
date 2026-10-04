/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/orders/route';
import { getAPIUser } from '@/lib/api/auth-helpers';
import { orderService } from '@/lib/services/orderService.server';
import { resolveUploadedFile } from '@/lib/storage/upload-reference';
import { hasPermission } from '@/lib/auth/rbac';
jest.mock('server-only',()=>({}));
jest.mock('@/lib/features/orders/access',()=>({visibleOrdersForActor:jest.fn()}));
jest.mock('@/lib/api/auth-helpers',()=>({getAPIUser:jest.fn(),successResponse:(data:unknown)=>Response.json({success:true,data}),errorResponse:(error:string,status:number)=>Response.json({success:false,error},{status}),handleCORS:jest.fn()}));
jest.mock('@/lib/services/orderService.server',()=>({orderService:{createOrder:jest.fn()}}));
jest.mock('@/lib/auth/rbac',()=>({hasPermission:jest.fn(),AuthorizationError:class extends Error{}}));
jest.mock('@/lib/storage/upload-reference',()=>({
 ...jest.requireActual('@/lib/storage/upload-reference'),resolveUploadedFile:jest.fn()
}));
jest.mock('@/lib/storage',()=>({readFile:jest.fn(),validateStorageKey:jest.fn()}));
const actor={id:'user',tenantId:'tenant',role:'owner',email:'owner@example.invalid',name:'Owner'};
const reference={name:'technical.pdf',mime:'application/pdf',blobPath:'uploads/tenant/user/id'};
function request(extra:Record<string,string>={}){
 const body=new FormData();
 for(const [key,value] of Object.entries({customerName:'Preview test',productName:'Profile',quantity:'1',totalAmount:'100',currency:'TRY',uploadedFiles:JSON.stringify([reference]),...extra}))body.set(key,value);
 return new NextRequest('https://renkflow.example/api/v1/orders',{method:'POST',body});
}
beforeEach(()=>{jest.clearAllMocks();jest.mocked(getAPIUser).mockResolvedValue(actor);jest.mocked(hasPermission).mockReturnValue(true);jest.mocked(orderService.createOrder).mockResolvedValue({id:'order'} as never);jest.mocked(resolveUploadedFile).mockResolvedValue(new File(['%PDF-'+ 'a'.repeat(6*1024*1024)],'technical.pdf',{type:'application/pdf'}));});
it('creates an order without a delivery date and retains a verified 6 MB Blob attachment',async()=>{
 const response=await POST(request());expect(response.status).toBe(200);
 expect(resolveUploadedFile).toHaveBeenCalledWith({tenantId:actor.tenantId,userId:actor.id},reference);
 const [tenant,data,files]=jest.mocked(orderService.createOrder).mock.calls[0];
 expect(tenant).toBe(actor.tenantId);expect(data.deliveryDate).toBeUndefined();expect(files?.[0].size).toBeGreaterThan(4.5*1024*1024);
});
it('rejects unowned or expired upload references before creating the order',async()=>{
 jest.mocked(resolveUploadedFile).mockRejectedValueOnce(new Error('Another user'));
 expect((await POST(request())).status).toBe(400);expect(orderService.createOrder).not.toHaveBeenCalled();
});
it('rejects malformed order lines instead of discarding them',async()=>{
 expect((await POST(request({items:'invalid-json'}))).status).toBe(400);expect(orderService.createOrder).not.toHaveBeenCalled();expect(resolveUploadedFile).not.toHaveBeenCalled();
});
it('checks write permission before resolving private files',async()=>{
 jest.mocked(hasPermission).mockReturnValue(false);expect((await POST(request())).status).toBe(403);expect(resolveUploadedFile).not.toHaveBeenCalled();
});
