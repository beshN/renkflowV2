import {buildSchedule,Center,Resource,ScheduleInput} from '@/lib/features/manufacturing/scheduler';
const center:Center={code:'CUT',parallelCapacity:2,shiftStart:'08:00',shiftEnd:'17:00',workDays:[1,2,3,4,5],maintenance:[]};
const op=(id:string,extra:Partial<ScheduleInput>={}):ScheduleInput=>({id,workOrderId:id,position:0,workCenterCode:'CUT',minutes:60,priority:'high',materialReady:true,...extra});
const machine:Resource={...center,id:'saw',kind:'machine',code:'SAW',parallelCapacity:1,maintenance:[{start:'2026-10-05T05:00:00Z',end:'2026-10-05T06:00:00Z'}]};
const start='2026-10-05T05:00:00Z';
it('prevents employee double booking across independent work centers',()=>{
 const r=buildSchedule([op('a',{assignedTo:'worker'}),op('b',{assignedTo:'worker',workCenterCode:'DRILL'})],[center,{...center,code:'DRILL'}],start);
 expect(Date.parse(r.tasks[1].start)).toBeGreaterThanOrEqual(Date.parse(r.tasks[0].end));
});
it('limits a shared machine despite excess work-center capacity and respects maintenance',()=>{
 const r=buildSchedule([op('a',{machineId:'saw'}),op('b',{machineId:'saw'})],[center],start,[machine]);
 expect(r.tasks[0].start).toBe('2026-10-05T06:00:00.000Z');expect(r.tasks[1].start).toBe(r.tasks[0].end);
});
it('fills resource gaps rather than blocking a whole day with a future reservation',()=>{
 const r=buildSchedule([op('a',{minutes:60,materialReady:false,materialReadyAt:'2026-10-05T08:00:00Z',machineId:'saw'}),op('b',{machineId:'saw'})],[center],start,[machine]);
 expect(r.tasks[0].start).toBe('2026-10-05T08:00:00.000Z');expect(r.tasks[1].start).toBe('2026-10-05T06:00:00.000Z');
});
it('intersects employee, team and center calendars and blocks missing physical assignments',()=>{
 const employee:Resource={...center,id:'operator',kind:'employee',userId:'w',code:'W',parallelCapacity:1,shiftStart:'13:00'};
 const team:Resource={...center,id:'team',kind:'team',code:'TEAM',parallelCapacity:1,memberIds:['w']};
 const r=buildSchedule([op('a',{assignedTo:'w',teamId:'team'})],[center],start,[employee,team]);expect(r.tasks[0].start).toBe('2026-10-05T10:00:00.000Z');
 expect(buildSchedule([op('b')],[{...center,machineRequired:true}],start).blocked[0].blockedReason).toContain('Makine');
});
it('keeps unknown material readiness blocked and plans supplied readiness without granting stock access',()=>{
 expect(buildSchedule([op('a',{materialReady:false})],[center],start).tasks).toHaveLength(0);
 const r=buildSchedule([op('a',{materialReady:false,materialReadyAt:'2026-10-06T05:00:00Z'})],[center],start);expect(r.tasks[0].start).toBe('2026-10-06T05:00:00.000Z');expect(r.tasks[0].explanation).toContain('stok onayı yerine geçmez');
});
