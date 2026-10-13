/** @jest-environment node */
import {AIService} from '@/lib/ai/service';
import Anthropic from '@anthropic-ai/sdk';
jest.mock('@anthropic-ai/sdk',()=>({__esModule:true,default:jest.fn()}));
const usage={input_tokens:10,output_tokens:5};
const toolTurn=(id:string,query:string)=>({stop_reason:'tool_use',usage,parsed_output:null,content:[{type:'thinking',thinking:'',signature:'sig-'+id},{type:'tool_use',id,name:'search_workspace',input:{category:'orders',query}}]});
const answer=(reply:unknown)=>({stop_reason:'end_turn',usage,content:[{type:'text',text:JSON.stringify(reply)}],parsed_output:reply});
let previous:string|undefined;
let requests:any[]=[];
/** Each request is copied when sent, since the service keeps appending to the same messages array. */
function mockModel(...responses:unknown[]) {
 requests=[];
 const parse=jest.fn(async(request:unknown)=>{requests.push(JSON.parse(JSON.stringify(request)));return responses.shift();});
 (Anthropic as unknown as jest.Mock).mockImplementation(()=>({messages:{parse}}));
}
beforeEach(()=>{previous=process.env.ANTHROPIC_API_KEY;process.env.ANTHROPIC_API_KEY='synthetic-test-key-'+Math.random();});
afterEach(()=>{if(previous===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=previous;});
it('returns the whole assistant turn (thinking included) and every tool result before asking again',async()=>{
 mockModel(toolTurn('toolu_1','RF-100'),answer({answer:'Siparişi buldum.',suggestions:[],actions:[]}));
 const search=jest.fn().mockResolvedValue([{order_number:'RF-100'}]);
 const reply=await new AIService().assist('RF-100 siparişini bul',{}, {},[],search);
 expect(reply.answer).toBe('Siparişi buldum.');expect(search).toHaveBeenCalledWith('orders','RF-100');
 const second=requests[1];
 expect(second.messages.at(-2)).toEqual({role:'assistant',content:toolTurn('toolu_1','RF-100').content});
 expect(second.messages.at(-1)).toEqual({role:'user',content:[{type:'tool_result',tool_use_id:'toolu_1',content:JSON.stringify([{order_number:'RF-100'}])}]});
 expect(second.tools.map((t:any)=>t.name)).toEqual(['search_workspace']);
 expect(second.tool_choice).toEqual({type:'auto'});
});
it('lets the last round only answer, keeping the tool declared for the earlier calls',async()=>{
 mockModel(toolTurn('toolu_1','a'),toolTurn('toolu_2','b'),answer({answer:'Bulamadım.',suggestions:[],actions:[]}));
 const reply=await new AIService().assist('ara',{}, {},[],jest.fn().mockResolvedValue([]));
 expect(reply.answer).toBe('Bulamadım.');
 expect(requests).toHaveLength(3);
 expect(requests[2].tool_choice).toEqual({type:'none'});
 expect(requests[2].tools).toHaveLength(1);
});
it('turns a refusal into an error instead of an empty answer',async()=>{
 mockModel({stop_reason:'refusal',usage,content:[],parsed_output:null});
 await expect(new AIService().assist('x',{}, {},[])).rejects.toMatchObject({code:'refusal'});
});
it('drops an order draft that does not fit the stored order shape and keeps valid ones',async()=>{
 const item=(quantity:number)=>({productName:'Pergola',quantity,widthMm:5000,heightMm:null,projectionMm:3500,mountingHeightMm:null,color:null,motorType:null,ledType:null,fabricType:null,notes:null,unit:null,sourcePage:null,evidence:'5x3,5',uncertainFields:[]});
 const draft=(quantity:number)=>({kind:'orderDraft',title:'Taslak',href:null,orderId:null,note:null,draft:{customerName:null,email:null,phone:null,deliveryDate:null,notes:null,items:[item(quantity)],warnings:[]}});
 mockModel(answer({answer:'Taslak hazır.',suggestions:[],actions:[draft(2),draft(0)]}));
 const reply=await new AIService().assist('taslak',{}, {},[]);
 expect(reply.actions).toHaveLength(1);
 expect(reply.actions[0].draft?.items[0]).toMatchObject({quantity:2,widthMm:5000,projectionMm:3500});
});
