export function qualityCostByCurrency(components:Array<{amount:number|null;currency:string|null;label:string}>){
 const totals:Record<string,number>={};let unknown=0;
 for(const c of components){if(c.amount===null || !c.currency){unknown++;continue;}if(!Number.isFinite(c.amount)||c.amount<0)throw new Error('Kalite maliyeti geçersiz');totals[c.currency]=Math.round(((totals[c.currency] || 0)+c.amount)*100)/100;}
 return {totals,unknownComponents:unknown,components};
}

/** Each completion advances the time baseline; later reworks contribute only the interrupted attempt. */
export function reworkLaborSeconds(snapshot:Array<{id:string;attempt:number}>,events:any[]){
 let seconds=0;
 for(const original of snapshot){
  const attempt=Number(original.attempt)+1;
  for(const e of events){const p=e.payload;
   if(e.event_type==='operation.complete' && e.operation_id===original.id && Number(p.before?.attempt)===attempt)seconds+=Math.max(0,Number(p.after.active_seconds)-Number(p.before.planning_baseline_seconds || 0));
   if(e.event_type==='operation.rework')for(const previous of p.previous || [])if(previous.id===original.id && Number(previous.attempt)===attempt)seconds+=Math.max(0,Number(previous.active_seconds)-Number(previous.planning_baseline_seconds || 0)+(previous.active_since?Math.max(0,(Date.parse(e.created_at)-Date.parse(previous.active_since))/1000):0));
  }
 }
 return seconds;
}
