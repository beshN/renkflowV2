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
it.each([
  {kind:'scrap',data:{reasonCode:'cut_error',quantity:2,photos:[]}},
  {kind:'delay',data:{reasonCode:'material',note:'Waiting for parts'}},
  {kind:'operation',data:{operationId:id,version:2,action:'rework',quantity:1,reason:'Size incorrect',reasonCode:'measurement',targetOperationId:id}},
])('accepts strict technical field commands without private fields',({kind,data})=>{
  const input={idempotencyKey:id,kind,data,...(kind==='operation'?{}:{workOrderId:id})};
  expect(()=>validateMobileDTO('SyncInput',input)).not.toThrow();
  expect(()=>validateMobileDTO('SyncInput',{...input,data:{...data,customerPhone:'555'}})).toThrow();
});
it('rejects non-positive scrap and too many photos',()=>{
  expect(()=>validateMobileDTO('ScrapInput',{reasonCode:'cut_error',quantity:0})).toThrow();
  expect(()=>validateMobileDTO('ScrapInput',{reasonCode:'cut_error',quantity:1,photos:Array(7).fill('/photo')})).toThrow();
});
it('requires a version and technical installation mutation, never customer fields',()=>{
  const input={idempotencyKey:id,kind:'installation',installationId:id,data:{action:'issue',expectedVersion:1,kind:'damage',text:'Paint scratched'}};
  expect(()=>validateMobileDTO('SyncInput',input)).not.toThrow();
  expect(()=>validateMobileDTO('SyncInput',{...input,data:{...input.data,address:'Private'}})).toThrow();
  expect(()=>validateMobileDTO('SyncInput',{...input,data:{action:'complete'}})).toThrow();
});
it('allows exactly one upload target and rejects ambiguous entity attachment',()=>{
  const upload={action:'init',uploadId:id,name:'saha.jpg',totalBytes:20,sha256:'0'.repeat(64)};
  expect(()=>validateMobileDTO('UploadInput',{...upload,workOrderId:id})).not.toThrow();
  expect(()=>validateMobileDTO('UploadInput',{...upload,installationId:id})).not.toThrow();
  expect(()=>validateMobileDTO('UploadInput',{...upload,workOrderId:id,installationId:id})).toThrow();
  expect(()=>validateMobileDTO('UploadInput',upload)).toThrow();
});
