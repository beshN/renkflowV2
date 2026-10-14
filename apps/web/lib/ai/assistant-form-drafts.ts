import { z } from 'zod';
import { WarehouseInputSchema, WAREHOUSE_TYPES } from '../features/warehouse/setup';
import { ATTENDANCE_KINDS, ATTENDANCE, type AttendanceKind } from '../features/personnel/payroll';
const attendance = z.object({ employeeId: z.uuid(), day: z.iso.date(), kind: z.enum(ATTENDANCE_KINDS as [string, ...string[]]) }).strict();
export function assistantFormHref(kind: string, note: string | null) {
  if (!note || note.length > 2000) return null;
  try {
    const raw = JSON.parse(note);
    if (kind === 'warehouseDraft') {
      const v = WarehouseInputSchema.parse(raw);
      return '/warehouse?' + new URLSearchParams({ create: 'warehouse', name: v.name, code: v.code, type: v.type }).toString();
    }
    if (kind === 'attendanceDraft') {
      const v = attendance.parse(raw);
      return '/finance/employees?' + new URLSearchParams({ attendance: 'new', employeeId: v.employeeId, day: v.day, kind: v.kind }).toString();
    }
  } catch { return null; }
  return null;
}

export function assistantFormSummary(kind: string, note: string | null) {
  if (!assistantFormHref(kind, note)) return null;
  const raw = JSON.parse(note!);
  if (kind === 'warehouseDraft') {
    const v = WarehouseInputSchema.parse(raw);
    return [{ label: 'Depo adı', value: v.name }, { label: 'Kullanım', value: WAREHOUSE_TYPES[v.type] }, { label: 'Depo kodu', value: v.code || 'Otomatik oluşturulacak' }];
  }
  const v = attendance.parse(raw);
  return [{ label: 'Gün', value: v.day.split('-').reverse().join('.') }, { label: 'Gün türü', value: ATTENDANCE[v.kind as AttendanceKind].label }, { label: 'Çalışan', value: 'Seçilen çalışan formda gösterilecek' }];
}
