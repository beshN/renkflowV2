/**
 * "Ya şöyle olsa?" (pure): compares the production plan before and after a change and says which
 * jobs start finishing late, which stop being late, and — for a cancellation — which waiting jobs the
 * freed material covers. The plan itself comes from the same scheduler the planning screen uses; the
 * model only reads the command and explains this result.
 */

export type PlanJob = { workOrderId: string; label: string; orderId: string | null; orderNumber: string | null; finishAt: string; dueAt: string | null; late: boolean };
export type Scenario = { scenario: 'expedite' | 'delay' | 'cancel'; orderNumber: string; days: number | null };

const hours = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 3_600_000);

export function comparePlans(before: PlanJob[], after: PlanJob[], changedOrderId: string) {
  const prev = new Map(before.map((j) => [j.workOrderId, j]));
  const nowLate: PlanJob[] = [];
  const fixed: PlanJob[] = [];
  const moved: Array<PlanJob & { shiftHours: number }> = [];
  for (const j of after) {
    const b = prev.get(j.workOrderId);
    if (!b) continue;
    if (j.late && !b.late) nowLate.push(j);
    if (!j.late && b.late) fixed.push(j);
    const shift = hours(b.finishAt, j.finishAt);
    if (Math.abs(shift) >= 1 && j.orderId !== changedOrderId) moved.push({ ...j, shiftHours: shift });
  }
  const others = (list: PlanJob[]) => list.filter((j) => j.orderId !== changedOrderId);
  const own = after.filter((j) => j.orderId === changedOrderId);
  return {
    newlyLate: others(nowLate),
    noLongerLate: others(fixed),
    ownLateAfter: own.some((j) => j.late),
    ownFinish: own.map((j) => j.finishAt).sort().pop() ?? null,
    shifted: moved.sort((a, b) => Math.abs(b.shiftHours) - Math.abs(a.shiftHours)).slice(0, 20),
  };
}

export type Need = { workOrderId: string; label: string; itemId: string; itemName: string; missing: number };
/** Material a cancelled order releases, given out to other jobs' missing quantities (largest need first). */
export function releasedMaterial(released: Array<{ itemId: string; itemName: string; quantity: number }>, needs: Need[]) {
  const pool = new Map(released.map((r) => [r.itemId, r.quantity]));
  const covered: Array<Need & { covered: number }> = [];
  for (const n of [...needs].sort((a, b) => b.missing - a.missing)) {
    const left = pool.get(n.itemId) ?? 0;
    if (left <= 0 || n.missing <= 0) continue;
    const take = Math.min(left, n.missing);
    pool.set(n.itemId, left - take);
    covered.push({ ...n, covered: take });
  }
  return { released, covered, fullyCovered: covered.filter((c) => c.covered >= c.missing).map((c) => c.workOrderId) };
}

/** One sentence per result, Turkish, from the numbers (the model may reword it; it may not change them). */
export function explain(s: Scenario, r: ReturnType<typeof comparePlans>, material?: ReturnType<typeof releasedMaterial>) {
  const head = s.scenario === 'expedite' ? `${s.orderNumber} öne alınırsa` : s.scenario === 'delay' ? `${s.orderNumber} ${s.days} gün ertelenirse` : `${s.orderNumber} iptal edilirse`;
  const parts: string[] = [];
  parts.push(r.newlyLate.length ? `${r.newlyLate.length} iş termine yetişmez (${r.newlyLate.slice(0, 3).map((j) => j.label).join(', ')}${r.newlyLate.length > 3 ? '…' : ''})` : 'başka hiçbir iş gecikmeye düşmez');
  if (r.noLongerLate.length) parts.push(`${r.noLongerLate.length} geciken iş yetişir hale gelir`);
  if (s.scenario !== 'cancel') parts.push(r.ownLateAfter ? `${s.orderNumber} yine de geç biter` : `${s.orderNumber} termine yetişir`);
  if (material?.covered.length) parts.push(`serbest kalan malzeme ${material.covered.length} işin eksiğini kapatır`);
  return `${head}: ${parts.join('; ')}.`;
}
