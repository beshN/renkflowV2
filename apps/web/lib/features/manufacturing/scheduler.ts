export type Center = {
  code: string;
  parallelCapacity: number;
  shiftStart: string;
  shiftEnd: string;
  workDays: number[];
  maintenance: Array<{ start: string; end: string }>;
  machineRequired?: boolean;teamRequired?: boolean;
};
export type ScheduleInput = {
  id: string;
  workOrderId: string;
  position: number;
  workCenterCode: string;
  minutes: number;
  priority: string;
  dueAt?: string;
  materialReady: boolean;
  materialReadyAt?: string;assignedTo?: string;machineId?: string;teamId?: string;blockedReason?: string;setupMinutes?: number;running?:boolean;
};
export function remainingOperationMinutes(operation: {
  plannedMinutes: number; plannedQty: number; completedQty: number;
  activeSeconds: number; baselineSeconds: number; activeSince?: string | null;
  setupMinutes?: number;
}, now = Date.now()) {
  if (operation.plannedQty <= 0) throw new Error("Plan adedi geçersiz");
  const currentRun = operation.activeSince ? Math.max(0, (now - Date.parse(operation.activeSince)) / 1000) : 0;
  const uncompletedSeconds = Math.max(0, operation.activeSeconds - operation.baselineSeconds) + currentRun;
  return Math.max(0.1, operation.plannedMinutes * (1 - operation.completedQty / operation.plannedQty) + (operation.completedQty===0 ? operation.setupMinutes || 0 : 0) - uncompletedSeconds / 60);
}
const dayMs = 86400000;
function dayStart(date: number) {
  return Math.floor((date + 3 * 3600000) / dayMs) * dayMs - 3 * 3600000;
} // Factory timezone Europe/Istanbul UTC+3.
function clock(v: string) {
  if (!/^\d{2}:\d{2}$/.test(v)) throw new Error("Vardiya saati geçersiz");
  const [h, m] = v.split(":").map(Number);
  if (h > 23 || m > 59) throw new Error("Vardiya saati geçersiz");
  return (h * 60 + m) * 60000;
}
function slot(center: Center, from: number, minutes: number) {
  const duration = minutes * 60000,
    s = clock(center.shiftStart),
    e = clock(center.shiftEnd);
  if (e <= s) throw new Error("Vardiya bitişi başlangıçtan sonra olmalı");
  let remaining = duration,
    t = from;
  const segments: Array<{ start: string; end: string }> = [];
  for (let iterations = 0; remaining > 0 && iterations < 4000; iterations++) {
    const d = dayStart(t),
      weekday = new Date(d + 3 * 3600000).getUTCDay();
    if (!center.workDays.includes(weekday)) {
      t = d + dayMs;
      continue;
    }
    t = Math.max(t, d + s);
    const end = d + e;
    if (t >= end) {
      t = d + dayMs;
      continue;
    }
    const blocks = center.maintenance
      .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
      .filter((b) => b.end > t && b.start < end)
      .sort((a, b) => a.start - b.start);
    if (blocks[0] && blocks[0].start <= t) {
      t = blocks[0].end;
      continue;
    }
    const availableEnd = Math.min(end, blocks[0]?.start ?? end),
      use = Math.min(remaining, availableEnd - t);
    if (use <= 0) {
      t = d + dayMs;
      continue;
    }
    segments.push({
      start: new Date(t).toISOString(),
      end: new Date(t + use).toISOString(),
    });
    remaining -= use;
    t += use;
  }
  if (remaining > 0) throw new Error("Planlama ufku aşıldı");
  return { start: segments[0].start, end: new Date(t).toISOString(), segments };
}
export type Resource = Center & {id:string;kind:"machine"|"team"|"employee";userId?:string;memberIds?:string[];workCenterCodes?:string[]};
export function buildSchedule(inputs: ScheduleInput[], centers: Center[], startAt: string, resources: Resource[] = []) {
  const start=Date.parse(startAt);
  if(!Number.isFinite(start))throw new Error("Başlangıç tarihi geçersiz");
  const calendars=new Map<string,Center>();
  const occupied=new Map<string,Array<Array<{start:string;end:string}>>>();
  function register(id:string,c:Center){
    if(!Number.isInteger(c.parallelCapacity)||c.parallelCapacity<1||c.parallelCapacity>100||!c.workDays.length||c.workDays.some(d=>!Number.isInteger(d)||d<0||d>6))throw new Error("Kaynak kapasitesi veya takvimi geçersiz");
    if(clock(c.shiftEnd)<=clock(c.shiftStart))throw new Error("Kaynak vardiyası geçersiz");
    for(const b of c.maintenance)if(!Number.isFinite(Date.parse(b.start))||!Number.isFinite(Date.parse(b.end))||Date.parse(b.end)<=Date.parse(b.start))throw new Error("Duruş takvimi geçersiz");
    if(calendars.has(id))throw new Error("Kaynak kodu tekrarlanıyor");
    calendars.set(id,c);occupied.set(id,Array.from({length:c.parallelCapacity},()=>[]));
  }
  for(const c of centers)register('center:'+c.code,c);
  for(const r of resources)register(r.id,r);
  for(const op of inputs)if(op.assignedTo && !resources.some(r=>r.kind==='employee'&&r.userId===op.assignedTo) && !calendars.has('employee:'+op.assignedTo))register('employee:'+op.assignedTo,{code:op.assignedTo,parallelCapacity:1,shiftStart:'00:00',shiftEnd:'23:59',workDays:[0,1,2,3,4,5,6],maintenance:[]});
  const priority:Record<string,number>={critical:0,high:1,medium:2,low:3};
  const groups=new Map<string,ScheduleInput[]>();
  for(const op of inputs){if(!Number.isFinite(op.minutes)||op.minutes<=0)throw new Error("Operasyon süresi geçersiz");if(op.materialReadyAt && !Number.isFinite(Date.parse(op.materialReadyAt)))throw new Error("Malzeme tarihi geçersiz");if(op.dueAt && !Number.isFinite(Date.parse(op.dueAt)))throw new Error("Termin geçersiz");const g=groups.get(op.workOrderId)||[];g.push(op);groups.set(op.workOrderId,g);}
  if(new Set(inputs.map(o=>o.id)).size!==inputs.length)throw new Error("Operasyonlar benzersiz olmalı");
  const tasks:Array<ScheduleInput & {start:string;end:string;lane:number;segments:Array<{start:string;end:string}>;late:boolean;resourceLanes:Array<{id:string;lane:number}>;explanation:string}>=[];
  const blocked:Array<ScheduleInput & {blockedReason:string}>=[];
  const ordered=[...groups.values()].sort((a,b)=>Number(b.some(o=>o.running))-Number(a.some(o=>o.running))||(priority[a[0].priority]??2)-(priority[b[0].priority]??2)||Date.parse(a[0].dueAt||'9999-01-01')-Date.parse(b[0].dueAt||'9999-01-01')||a[0].workOrderId.localeCompare(b[0].workOrderId));
  for(const group of ordered){
    let reason='';
    for(const op of group){
      const c=calendars.get('center:'+op.workCenterCode);
      if(!c)throw new Error("İstasyon bulunamadı: "+op.workCenterCode);
      reason ||= op.blockedReason || (!op.materialReady && !op.materialReadyAt ? 'Malzeme hazırlığı bekleniyor' : '') || (c.machineRequired && !op.machineId ? 'Makine ataması gerekli' : '') || (c.teamRequired && !op.teamId ? 'Ekip ataması gerekli' : '');
      for(const [id,kind] of [[op.machineId,'machine'],[op.teamId,'team']] as const)if(id && !resources.some(r=>r.id===id && r.kind===kind))throw new Error("Planlama kaynağı bulunamadı");
      for(const id of [op.machineId,op.teamId]){const r=resources.find(r=>r.id===id);if(r?.workCenterCodes?.length && !r.workCenterCodes.includes(op.workCenterCode))reason ||= "Kaynak bu iş merkezine uygun değil";}
      const team=resources.find(r=>r.id===op.teamId);
      if(team && op.assignedTo && !team.memberIds?.includes(op.assignedTo))reason ||= 'Atanan çalışan ekipte bulunmuyor';
    }
    if(reason){blocked.push(...group.map(op=>({...op,blockedReason:reason})));continue;}
    let dependency=Math.max(start,...group.map(op=>!op.materialReady && op.materialReadyAt ? Date.parse(op.materialReadyAt) : start));
    for(const op of group.sort((a,b)=>a.position-b.position)){
      const ids=['center:'+op.workCenterCode,...(op.machineId?[op.machineId]:[]),...(op.teamId?[op.teamId]:[]),...(op.assignedTo?[resources.find(r=>r.kind==='employee'&&r.userId===op.assignedTo)?.id || 'employee:'+op.assignedTo]:[])];
      const source=ids.map(id=>calendars.get(id)!);
      const merged:Center={...source[0],shiftStart:source.map(c=>c.shiftStart).sort().slice(-1)[0],shiftEnd:source.map(c=>c.shiftEnd).sort()[0],workDays:source[0].workDays.filter(d=>source.every(c=>c.workDays.includes(d))),maintenance:source.flatMap(c=>c.maintenance)};
      if(merged.shiftStart>=merged.shiftEnd || !merged.workDays.length){reason='Kaynakların ortak çalışma takvimi yok';break;}
      // Bounded lane search; each trial treats other resource occupancy as downtime.
      const options=[];
      for(let centerLane=0;centerLane<occupied.get(ids[0])!.length;centerLane++){
        const choices=ids.map((id,i)=>({id,lane:i===0?centerLane:0}));
        let candidate;
        for(let iteration=0;iteration<20;iteration++){
          let changed=false;
          for(let i=1;i<ids.length;i++){
            const alternatives=occupied.get(ids[i])!.map((_,lane)=>{
              const pick=choices.map((v,n)=>n===i?{...v,lane}:v);
              const maintenance=[...merged.maintenance,...pick.flatMap(p=>occupied.get(p.id)![p.lane])];
              return {lane,...slot({...merged,maintenance},dependency,op.minutes)};
            }).sort((a,b)=>Date.parse(a.end)-Date.parse(b.end)||a.lane-b.lane);
            if(choices[i].lane!==alternatives[0].lane){choices[i].lane=alternatives[0].lane;changed=true;}
          }
          candidate=slot({...merged,maintenance:[...merged.maintenance,...choices.flatMap(p=>occupied.get(p.id)![p.lane])]},dependency,op.minutes);
          if(!changed)break;
        }
        options.push({...candidate!,lane:centerLane,resourceLanes:choices});
      }
      const choice=options.sort((a,b)=>Date.parse(a.end)-Date.parse(b.end)||a.lane-b.lane)[0];
      dependency=Date.parse(choice.end);
      for(const resource of choice.resourceLanes)occupied.get(resource.id)![resource.lane].push(...choice.segments);
      tasks.push({...op,...choice,late:!!op.dueAt&&dependency>Date.parse(op.dueAt),explanation:`${op.running ? "Devam eden operasyon önce yerleştirildi. " : ""}Öncelik: ${op.priority}; termin: ${op.dueAt || 'belirtilmedi'}. Önceki operasyon, ortak vardiya, duruş ve ${ids.length} kaynak kapasitesi doğrulandı.${op.materialReadyAt && !op.materialReady ? ' Malzeme tahmini hazır olma tarihinden sonra planlandı; stok onayı yerine geçmez.' : ''}`});
    }
    if(reason)blocked.push(...group.filter(op=>!tasks.some(t=>t.id===op.id)).map(op=>({...op,blockedReason:reason})));
  }
  return {tasks,blocked,algorithm:'finite-capacity-priority-due-date',timezone:'Europe/Istanbul'};
}
