/** @jest-environment node */
import {NextRequest} from 'next/server';
const mockActor=jest.fn(),mockSnapshot=jest.fn(),mockSettings=jest.fn(),mockKey=jest.fn();
jest.mock('@/lib/features/work-orders/security',()=>({requireWorkOrderActor:()=>mockActor(),WorkOrderApiError:class extends Error {status=401}}));
jest.mock('@/lib/ai/workspace',()=>({assistantSnapshot:(...args:unknown[])=>mockSnapshot(...args)}));
jest.mock('@/lib/ai/service',()=>({aiAvailable:()=>mockKey()}));
jest.mock('@/lib/ai/gate.server',()=>({getAiSettings:(...args:unknown[])=>mockSettings(...args)}));
import {GET} from '@/app/api/ai/insights/route';
import {modelConfigurationBlock,modelUnavailableMessage} from '@/lib/ai/policy';
let tenant=0;
beforeEach(()=>{jest.clearAllMocks();mockActor.mockResolvedValue({tenantId:'tenant-'+(++tenant),userId:'u',role:'owner'});mockSnapshot.mockResolvedValue({insights:[],fingerprint:'f',data:{generatedAt:'now',unavailable:[]}});mockKey.mockReturnValue(true);});
const request=()=>GET(new NextRequest('https://renkflow.com/api/ai/insights'));
it('a configured key in rules mode does not report a missing key',async()=>{mockSettings.mockResolvedValue({mode:'rules',kvkkAckAt:null});const data=await (await request()).json();expect(data.modelEnabled).toBe(false);expect(data.modelUnavailableReason).toBe('AI_RULES_ONLY');expect(modelUnavailableMessage(data.modelUnavailableReason)).not.toContain('anahtarı');});
it('only actual missing credentials report a missing key',async()=>{mockSettings.mockResolvedValue({mode:'assist',kvkkAckAt:'ack'});mockKey.mockReturnValue(false);expect((await (await request()).json()).modelUnavailableReason).toBe('AI_KEY_MISSING');});
it('settings changes reopen chat without waiting for cached workspace expiry',async()=>{mockSettings.mockResolvedValueOnce({mode:'rules',kvkkAckAt:null}).mockResolvedValueOnce({mode:'assist',kvkkAckAt:'ack'});expect((await (await request()).json()).modelEnabled).toBe(false);expect((await (await request()).json()).modelEnabled).toBe(true);expect(mockSnapshot).toHaveBeenCalledTimes(1);});
it('off and missing consent remain protected independently of the key',()=>{expect(modelConfigurationBlock({mode:'off',kvkkAckAt:'ack'},true)).toBe('AI_OFF');expect(modelConfigurationBlock({mode:'assist',kvkkAckAt:null},true)).toBe('AI_KVKK');});
