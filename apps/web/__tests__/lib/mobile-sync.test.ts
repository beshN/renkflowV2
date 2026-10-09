/** @jest-environment node */
import { validateMobileDTO } from '@/lib/features/mobile/contract';
import { requestHash, MobileConflict } from '@/lib/features/mobile/sync';
jest.mock('server-only',()=>({}));
jest.mock('@/auth',()=>({auth:jest.fn()}));
jest.mock('@/lib/db',()=>({sql:jest.fn()}));
const id='00000000-0000-4000-8000-000000000001';
it('uses a canonical fingerprint independent of JSON object key order',()=>{
  expect(requestHash({kind:'comment',data:{body:'note'},id})).toBe(requestHash({id,data:{body:'note'},kind:'comment'}));
  expect(requestHash({data:{body:'one'}})).not.toBe(requestHash({data:{body:'two'}}));
});
it.each([
  {idempotencyKey:id,kind:'comment',workOrderId:id,data:{body:'Offline note'}},
  {idempotencyKey:id,kind:'checklist',workOrderId:id,data:{itemId:id,completed:true,expectedCompleted:false}},
  {idempotencyKey:id,kind:'operation',data:{operationId:id,version:1,action:'start',qualityResults:[],photos:[]}},
  {idempotencyKey:id,kind:'transition',workOrderId:id,data:{status:'in_progress',expectedUpdatedAt:'2026-10-09T00:00:00.000Z'}},
])('validates each offline mutation shape from the one API contract',body=>expect(()=>validateMobileDTO('SyncInput',body)).not.toThrow());
it.each([
  {idempotencyKey:id,kind:'comment',workOrderId:id,data:{body:'note',price:123}},
  {idempotencyKey:id,kind:'checklist',workOrderId:id,data:{itemId:id,completed:true}},
  {idempotencyKey:id,kind:'transition',workOrderId:id,data:{status:'done'}},
  {idempotencyKey:id,kind:'operation',data:{operationId:id,version:1,action:'force'}},
  {idempotencyKey:'broken',kind:'comment',workOrderId:id,data:{body:'note'}},
])('rejects corrupt queue payloads before writes',body=>expect(()=>validateMobileDTO('SyncInput',body)).toThrow());
it('distinguishes retryable revision conflicts from terminal restrictions',()=>{
  expect(new MobileConflict('closed',false)).toMatchObject({status:409,canRetry:false});
  expect(new MobileConflict('changed',true)).toMatchObject({status:409,canRetry:true});
});
