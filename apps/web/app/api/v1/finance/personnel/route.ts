import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSameOriginJson } from '@/lib/features/manufacturing/http-security';
import { requireWorkOrderActor } from '@/lib/features/work-orders/security';
import { NO_STORE, recordError } from '@/lib/features/records/http';
import { redactedJson } from '@/lib/security/field-access.server';
import { attendancePolicy, saveAttendancePolicy, addLedger, deleteLedger, employeeDetail, personnelOverview, saveEmployee, setAttendance } from '@/lib/features/personnel/service.server';

export const dynamic = 'force-dynamic';

/** Personnel: the month's overview, or one person's card (?employeeId=). */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    if (req.nextUrl.searchParams.get('view') === 'policy') return redactedJson(await attendancePolicy(actor), { headers: NO_STORE });
    const period = req.nextUrl.searchParams.get('period');
    const employeeId = req.nextUrl.searchParams.get('employeeId');
    return redactedJson(employeeId ? await employeeDetail(actor, employeeId, period) : await personnelOverview(actor, period), { headers: NO_STORE });
  } catch (e) {
    return recordError(e, 'personnel');
  }
}

const Body = z.object({ action: z.enum(['employee.save', 'attendance.set', 'ledger.add', 'ledger.delete', 'policy.save']), input: z.unknown() });

export async function POST(req: NextRequest) {
  try {
    requireSameOriginJson(req, 200_000);
    const actor = await requireWorkOrderActor();
    const { action, input } = Body.parse(await req.json());
    const run = { 'policy.save': saveAttendancePolicy, 'employee.save': saveEmployee, 'attendance.set': setAttendance, 'ledger.add': addLedger, 'ledger.delete': deleteLedger }[action];
    return redactedJson(await run(actor, input), { headers: NO_STORE });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const first = e.issues[0];
      return redactedJson({ error: first?.message && !/^Invalid|^Expected/.test(first.message) ? first.message : 'Geçersiz istek' }, { status: 400, headers: NO_STORE });
    }
    return recordError(e, 'personnel');
  }
}
