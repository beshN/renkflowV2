'use server';

/**
 * Time Tracking Server Actions
 * CRUD operations for time entries
 */

import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// ============================================
// Validation Schemas
// ============================================

const TimeEntrySchema = z.object({
  taskId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  duration: z.number().min(0),
  billable: z.boolean().default(false),
  hourlyRate: z.number().min(0).optional(),
  tags: z.array(z.string()).default([]),
  source: z.enum(['timer', 'manual', 'import', 'pomodoro']).default('manual'),
});

const UpdateTimeEntrySchema = TimeEntrySchema.partial();

// ============================================
// Types
// ============================================

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface TimeEntry {
  id: string;
  tenantId: string;
  userId: string;
  taskId?: string;
  orderId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  duration: number;
  billable: boolean;
  hourlyRate?: number;
  tags: string[];
  status: 'running' | 'paused' | 'stopped';
  source: 'timer' | 'manual' | 'import' | 'pomodoro';
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Helper Functions
// ============================================

async function getSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ============================================
// Server Actions
// ============================================

export async function createTimeEntry(
  data: z.infer<typeof TimeEntrySchema>
): Promise<ActionResult<TimeEntry>> {
  try {
    const session = await getSession();
    const validated = TimeEntrySchema.parse(data);

    const result = await sql`
      INSERT INTO time_entries (
        tenant_id,
        user_id,
        task_id,
        order_id,
        description,
        start_time,
        end_time,
        duration,
        billable,
        hourly_rate,
        tags,
        status,
        source
      ) VALUES (
        ${session.user.tenantId},
        ${session.user.id},
        ${validated.taskId || null},
        ${validated.orderId || null},
        ${validated.description || null},
        ${validated.startTime},
        ${validated.endTime || null},
        ${validated.duration},
        ${validated.billable},
        ${validated.hourlyRate || null},
        ${validated.tags},
        'stopped',
        ${validated.source}
      )
      RETURNING *
    `;

    revalidatePath('/time-tracking');

    return {
      success: true,
      data: mapTimeEntry(result[0]),
    };
  } catch (error) {
    console.error('[TimeTracking] Create error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create time entry',
    };
  }
}

export async function updateTimeEntry(
  entryId: string,
  data: z.infer<typeof UpdateTimeEntrySchema>
): Promise<ActionResult<TimeEntry>> {
  try {
    const session = await getSession();
    const validated = UpdateTimeEntrySchema.parse(data);

    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];

    if (validated.description !== undefined) {
      updates.push('description = $' + (values.length + 1));
      values.push(validated.description);
    }
    if (validated.startTime !== undefined) {
      updates.push('start_time = $' + (values.length + 1));
      values.push(validated.startTime);
    }
    if (validated.endTime !== undefined) {
      updates.push('end_time = $' + (values.length + 1));
      values.push(validated.endTime);
    }
    if (validated.duration !== undefined) {
      updates.push('duration = $' + (values.length + 1));
      values.push(validated.duration);
    }
    if (validated.billable !== undefined) {
      updates.push('billable = $' + (values.length + 1));
      values.push(validated.billable);
    }
    if (validated.tags !== undefined) {
      updates.push('tags = $' + (values.length + 1));
      values.push(validated.tags);
    }

    if (updates.length === 0) {
      return { success: false, error: 'No updates provided' };
    }

    const result = await sql`
      UPDATE time_entries
      SET description = COALESCE(${validated.description}, description),
          start_time = COALESCE(${validated.startTime}, start_time),
          end_time = COALESCE(${validated.endTime}, end_time),
          duration = COALESCE(${validated.duration}, duration),
          billable = COALESCE(${validated.billable}, billable),
          tags = COALESCE(${validated.tags}, tags),
          updated_at = NOW()
      WHERE id = ${entryId}
        AND tenant_id = ${session.user.tenantId}
        AND user_id = ${session.user.id}
      RETURNING *
    `;

    if (result.length === 0) {
      return { success: false, error: 'Time entry not found' };
    }

    revalidatePath('/time-tracking');

    return {
      success: true,
      data: mapTimeEntry(result[0]),
    };
  } catch (error) {
    console.error('[TimeTracking] Update error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update time entry',
    };
  }
}

export async function deleteTimeEntry(entryId: string): Promise<ActionResult> {
  try {
    const session = await getSession();

    const result = await sql`
      DELETE FROM time_entries
      WHERE id = ${entryId}
        AND tenant_id = ${session.user.tenantId}
        AND user_id = ${session.user.id}
      RETURNING id
    `;

    if (result.length === 0) {
      return { success: false, error: 'Time entry not found' };
    }

    revalidatePath('/time-tracking');

    return { success: true };
  } catch (error) {
    console.error('[TimeTracking] Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete time entry',
    };
  }
}

export async function getTimeEntries(params: {
  startDate?: string;
  endDate?: string;
  taskId?: string;
  orderId?: string;
  billable?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ entries: TimeEntry[]; total: number }>> {
  try {
    const session = await getSession();
    const { startDate, endDate, taskId, orderId, billable, limit = 50, offset = 0 } = params;

    let whereClause = sql`tenant_id = ${session.user.tenantId} AND user_id = ${session.user.id}`;

    if (startDate) {
      whereClause = sql`${whereClause} AND start_time >= ${startDate}`;
    }
    if (endDate) {
      whereClause = sql`${whereClause} AND start_time <= ${endDate}`;
    }
    if (taskId) {
      whereClause = sql`${whereClause} AND task_id = ${taskId}`;
    }
    if (orderId) {
      whereClause = sql`${whereClause} AND order_id = ${orderId}`;
    }
    if (billable !== undefined) {
      whereClause = sql`${whereClause} AND billable = ${billable}`;
    }

    const [entries, countResult] = await Promise.all([
      sql`
        SELECT * FROM time_entries
        WHERE ${whereClause}
        ORDER BY start_time DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total FROM time_entries
        WHERE ${whereClause}
      `,
    ]);

    return {
      success: true,
      data: {
        entries: entries.map(mapTimeEntry),
        total: parseInt(countResult[0]?.total || '0'),
      },
    };
  } catch (error) {
    console.error('[TimeTracking] Get entries error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get time entries',
    };
  }
}

export async function getTodayTotal(): Promise<ActionResult<{ totalSeconds: number; billableSeconds: number }>> {
  try {
    const session = await getSession();
    const today = new Date().toISOString().split('T')[0];

    const result = await sql`
      SELECT 
        COALESCE(SUM(duration), 0) as total_seconds,
        COALESCE(SUM(CASE WHEN billable THEN duration ELSE 0 END), 0) as billable_seconds
      FROM time_entries
      WHERE tenant_id = ${session.user.tenantId}
        AND user_id = ${session.user.id}
        AND DATE(start_time) = ${today}
    `;

    return {
      success: true,
      data: {
        totalSeconds: parseInt(result[0]?.total_seconds || '0'),
        billableSeconds: parseInt(result[0]?.billable_seconds || '0'),
      },
    };
  } catch (error) {
    console.error('[TimeTracking] Get today total error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get today total',
    };
  }
}

export async function getWeeklyReport(weekStart: string): Promise<ActionResult<{
  days: { date: string; totalSeconds: number; billableSeconds: number }[];
  totalSeconds: number;
  billableSeconds: number;
}>> {
  try {
    const session = await getSession();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const result = await sql`
      SELECT 
        DATE(start_time) as date,
        COALESCE(SUM(duration), 0) as total_seconds,
        COALESCE(SUM(CASE WHEN billable THEN duration ELSE 0 END), 0) as billable_seconds
      FROM time_entries
      WHERE tenant_id = ${session.user.tenantId}
        AND user_id = ${session.user.id}
        AND DATE(start_time) >= ${weekStart}
        AND DATE(start_time) <= ${weekEnd.toISOString().split('T')[0]}
      GROUP BY DATE(start_time)
      ORDER BY date
    `;

    const days = result.map((row: any) => ({
      date: row.date,
      totalSeconds: parseInt(row.total_seconds),
      billableSeconds: parseInt(row.billable_seconds),
    }));

    const totalSeconds = days.reduce((sum, d) => sum + d.totalSeconds, 0);
    const billableSeconds = days.reduce((sum, d) => sum + d.billableSeconds, 0);

    return {
      success: true,
      data: { days, totalSeconds, billableSeconds },
    };
  } catch (error) {
    console.error('[TimeTracking] Get weekly report error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get weekly report',
    };
  }
}

// ============================================
// Mapping Function
// ============================================

function mapTimeEntry(row: any): TimeEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    taskId: row.task_id,
    orderId: row.order_id,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    billable: row.billable,
    hourlyRate: row.hourly_rate,
    tags: row.tags || [],
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
