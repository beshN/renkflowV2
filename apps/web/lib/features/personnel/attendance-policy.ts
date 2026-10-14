import { z } from 'zod';
import type { AttendanceKind } from './payroll';
export const AttendanceRulesSchema = z.object({
  absent: z.number().finite().min(0).max(3).multipleOf(0.05),
  unpaid_leave: z.number().finite().min(0).max(1).multipleOf(0.05),
  half_day: z.number().finite().min(0).max(1).multipleOf(0.05),
}).strict();
export type AttendanceRules = z.infer<typeof AttendanceRulesSchema>;
export type AttendancePolicy = { version: number; rules: AttendanceRules; updatedAt: string | null };
export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = { version: 0, rules: { absent: 1.5, unpaid_leave: 1, half_day: 0.5 }, updatedAt: null };
export function policyDays(kind: AttendanceKind, policy: AttendancePolicy) { return kind in policy.rules ? policy.rules[kind as keyof AttendanceRules] : 0; }
export type AttendanceSnapshot = { version: 1; policyVersion: number; kind: AttendanceKind; cutDays: number; dailyRate: number | null; currency: string; basis: 'monthly_30' | 'daily'; recordedAt: string };
