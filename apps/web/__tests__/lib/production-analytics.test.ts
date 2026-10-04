import {calculateProductionMetrics,HistoricalCenter} from '@/lib/features/manufacturing/analytics';
const now=Date.parse('2026-10-05T05:00:00Z');
const centers=[{code:'CUT',name:'Kesim',parallel_capacity:1,shift_start:'08:00',shift_end:'17:00'},{code:'PACK',name:'Paketleme',parallel_capacity:1,shift_start:'08:00',shift_end:'17:00'}];
const op=(id:string,position=0)=>({id,work_order_id:id.split('-')[0],order_id:'order',work_center_code:position===0?'CUT':'PACK',position,status:'ready',planned_qty:2,completed_qty:0,planned_minutes:300,active_seconds:0,planning_baseline_seconds:0,ready_at:'2026-10-05T04:00:00Z',reservation_status:'transferred'});
const history:HistoricalCenter[]=[{code:'CUT',samples:6,units:12,activeSeconds:600,cycleSeconds:900,waitingSeconds:100,reworkAttempts:2,throughput24h:4}];
it('counts WIP only at the current operation and derives a capacity bottleneck',()=>{
 const result=calculateProductionMetrics([op('a-1'),op('a-2',1),op('b-1')],centers,history,{tasks:[],blocked:[]},[],now);
 expect(result.wipJobs).toBe(2);expect(result.centers[0]).toMatchObject({code:'CUT',wipQuantity:4,bottleneck:true,queueLength:2,baselineReliable:true,throughput24h:4});expect(result.centers[1].wipJobs).toBe(0);
});
it('uses actual scheduled completion and blocks dates for missing material or unplanned lines',()=>{
 const operations=[op('a-1')],task={id:'a-1',end:'2026-10-06T12:00:00Z',start:'2026-10-05T05:00:00Z'},order={id:'order',order_number:'RF-1',delivery_date:'2026-10-05',unplanned_lines:0};
 const result=calculateProductionMetrics(operations,centers,history,{tasks:[task],blocked:[]},[order],now);
 expect(result.predictions[0].estimatedCompletion).toBe(new Date(task.end).toISOString());expect(result.predictions[0].delayMinutes).toBeGreaterThan(0);
 const blocked=calculateProductionMetrics(operations,centers,history,{tasks:[],blocked:[{id:'a-1',blockedReason:'Malzeme bekleniyor'}]},[order],now);expect(blocked.predictions[0].estimatedCompletion).toBeNull();
 expect(calculateProductionMetrics(operations,centers,history,{tasks:[task],blocked:[]},[{...order,unplanned_lines:1}],now).predictions[0].estimatedCompletion).toBeNull();
});
it('does not manufacture statistical confidence or delays without data',()=>{
 const result=calculateProductionMetrics([],centers,[],{tasks:[],blocked:[]},[],now);expect(result.centers[0].baselineReliable).toBe(false);expect(result.centers[0].reworkRate).toBeNull();expect(result.predictions).toEqual([]);
});
