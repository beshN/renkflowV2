import {qualityCostByCurrency,reworkLaborSeconds} from '@/lib/features/manufacturing/quality-intelligence';
it('keeps currencies separate and reports unknown costs rather than assuming zero',()=>{
 const result=qualityCostByCurrency([{label:'Material',amount:20,currency:'TRY'},{label:'Labor',amount:5,currency:'TRY'},{label:'Motor',amount:10,currency:'EUR'},{label:'Legacy lot',amount:null,currency:null}]);
 expect(result.totals).toEqual({TRY:25,EUR:10});expect(result.unknownComponents).toBe(1);
});
it('rejects invalid amounts and accepts confirmed zero without inventing a conversion',()=>{
 expect(qualityCostByCurrency([{label:'Known zero',amount:0,currency:'TRY'}]).totals).toEqual({TRY:0});
 expect(()=>qualityCostByCurrency([{label:'Invalid',amount:-1,currency:'TRY'}])).toThrow();
});

it('attributes partial completions and interrupted rework once, excluding later attempts',()=>{
 const events=[
 {event_type:'operation.complete',operation_id:'op',payload:{before:{attempt:2,planning_baseline_seconds:100},after:{active_seconds:160}}},
 {event_type:'operation.complete',operation_id:'op',payload:{before:{attempt:2,planning_baseline_seconds:160},after:{active_seconds:180}}},
 {event_type:'operation.rework',created_at:'2026-10-04T10:01:00Z',payload:{previous:[{id:'op',attempt:2,active_seconds:190,planning_baseline_seconds:180,active_since:'2026-10-04T10:00:30Z'}]}},
 {event_type:'operation.complete',operation_id:'op',payload:{before:{attempt:3,planning_baseline_seconds:220},after:{active_seconds:250}}}
 ];
 expect(reworkLaborSeconds([{id:'op',attempt:1}],events)).toBe(120);
 expect(reworkLaborSeconds([{id:'op',attempt:2}],events)).toBe(30);
});
