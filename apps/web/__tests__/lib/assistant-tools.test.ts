/** @jest-environment node */
import {AIService} from '@/lib/ai/service';
import OpenAI from 'openai';
jest.mock('openai',()=>({__esModule:true,default:jest.fn()}));
it('strips SDK-only parsed_arguments before resubmitting tool calls to Responses API',async()=>{
 const parse=jest.fn().mockResolvedValueOnce({status:'completed',output:[{type:'function_call',id:'fc_1',call_id:'call_1',name:'search_workspace',arguments:'{"category":"orders","query":"RF-100"}',parsed_arguments:{category:'orders',query:'RF-100'}}]}).mockResolvedValueOnce({status:'completed',output:[],output_parsed:{answer:'Siparişi buldum.',suggestions:[],actions:[]}});
 (OpenAI as unknown as jest.Mock).mockImplementation(()=>({responses:{parse}}));
 const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='synthetic-test-key';
 try {
  const search=jest.fn().mockResolvedValue([{order_number:'RF-100'}]);
  const reply=await new AIService().assist('RF-100 siparişini bul',{}, {},[],search);
  expect(reply.answer).toBe('Siparişi buldum.');expect(search).toHaveBeenCalledWith('orders','RF-100');
  const second=parse.mock.calls[1][0];
  const call=second.input.find((i:any)=>i.type==='function_call');
  expect(call).toEqual({type:'function_call',call_id:'call_1',name:'search_workspace',arguments:'{"category":"orders","query":"RF-100"}'});
  expect(second.input.some((i:any)=>i.type==='function_call_output'&&i.call_id==='call_1')).toBe(true);
 }finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});
