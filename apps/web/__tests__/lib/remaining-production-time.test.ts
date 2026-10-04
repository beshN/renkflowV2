import { remainingOperationMinutes } from '@/lib/features/manufacturing/scheduler';
it('retains a meaningful remaining duration after partial production and rework',()=>{
  const operation={plannedMinutes:20,plannedQty:2,completedQty:1,activeSeconds:600,baselineSeconds:600};
  expect(remainingOperationMinutes(operation)).toBe(10);
  expect(remainingOperationMinutes({...operation,activeSeconds:720})).toBe(8);
  expect(remainingOperationMinutes({...operation,completedQty:0,activeSeconds:1200,baselineSeconds:1200})).toBe(20);
});
it('deducts only work on the remaining quantity, including the active interval',()=>{
  const now=Date.parse('2026-10-05T08:03:00Z');
  expect(remainingOperationMinutes({plannedMinutes:20,plannedQty:2,completedQty:1,activeSeconds:720,baselineSeconds:600,activeSince:'2026-10-05T08:00:00Z'},now)).toBe(5);
});
