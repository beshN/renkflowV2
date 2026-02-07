'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import {
  getServerUserContext,
  requirePermission,
} from '@/lib/auth/serverAuth';
import {
  Employee,
  CreateEmployeeInput,
  CreateEmployeeSchema,
  UpdateEmployeeInput,
  UpdateEmployeeSchema,
  EmployeeLedgerEntry,
  CreateLedgerEntryInput,
  CreateLedgerEntrySchema,
} from '@/lib/types/finance';
import { isMissingRelationError, tableExists } from '@/lib/db/schema-guard';

// ============================================
// Employee Actions
// ============================================

/**
 * Create a new employee
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.employees.create');

  // Validate input
  const validated = CreateEmployeeSchema.parse(input);

  const result = await sql`
    INSERT INTO employees (
      tenant_id, full_name, title, email, phone
    ) VALUES (
      ${context.tenantId},
      ${validated.fullName},
      ${validated.title || null},
      ${validated.email || null},
      ${validated.phone || null}
    )
    RETURNING *
  `;

  revalidatePath('/finance/employees');

  const rows = result as any[];
  const row = rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    fullName: row.full_name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List all employees
 */
export async function listEmployees(includeInactive: boolean = false): Promise<Employee[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.employees.view');

  const employeesTableReady = await tableExists('employees');
  if (!employeesTableReady) {
    return [];
  }

  try {
    let result;
    
    if (includeInactive) {
      result = await sql`
        SELECT * FROM employees 
        WHERE tenant_id = ${context.tenantId}
        ORDER BY full_name ASC
      `;
    } else {
      result = await sql`
        SELECT * FROM employees 
        WHERE tenant_id = ${context.tenantId}
        AND active = true
        ORDER BY full_name ASC
      `;
    }

    const rows = result as any[];
    return rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      fullName: row.full_name,
      title: row.title,
      email: row.email,
      phone: row.phone,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    if (isMissingRelationError(error, ['employees'])) {
      return [];
    }
    throw error;
  }
}

/**
 * Get employee by ID
 */
export async function getEmployeeById(employeeId: string): Promise<Employee | null> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.employees.view');

  const result = await sql`
    SELECT * FROM employees 
    WHERE id = ${employeeId} AND tenant_id = ${context.tenantId}
    LIMIT 1
  `;

  const rows = result as any[];
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    fullName: row.full_name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Update an employee
 */
export async function updateEmployee(
  employeeId: string,
  input: UpdateEmployeeInput
): Promise<Employee> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.employees.edit');

  // Validate input
  const validated = UpdateEmployeeSchema.parse(input);

  // Verify employee belongs to tenant
  const empCheck = await sql`
    SELECT id FROM employees 
    WHERE id = ${employeeId} AND tenant_id = ${context.tenantId}
    LIMIT 1
  `;

  const empCheckRows = empCheck as any[];
  if (empCheckRows.length === 0) {
    throw new Error('Çalışan bulunamadı');
  }

  const result = await sql`
    UPDATE employees SET
      full_name = COALESCE(${validated.fullName}, full_name),
      title = COALESCE(${validated.title}, title),
      email = COALESCE(${validated.email}, email),
      phone = COALESCE(${validated.phone}, phone),
      active = COALESCE(${validated.active}, active),
      updated_at = NOW()
    WHERE id = ${employeeId} AND tenant_id = ${context.tenantId}
    RETURNING *
  `;

  revalidatePath('/finance/employees');
  revalidatePath(`/finance/employees/${employeeId}`);

  const rows = result as any[];
  const row = rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    fullName: row.full_name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Delete an employee (owner/admin only)
 */
export async function deleteEmployee(employeeId: string): Promise<void> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.employees.delete');

  // Verify employee belongs to tenant
  const empCheck = await sql`
    SELECT id FROM employees 
    WHERE id = ${employeeId} AND tenant_id = ${context.tenantId}
    LIMIT 1
  `;
  const empCheckRows = empCheck as any[];

  if (empCheckRows.length === 0) {
    throw new Error('Çalışan bulunamadı');
  }

  await sql`
    DELETE FROM employees 
    WHERE id = ${employeeId} AND tenant_id = ${context.tenantId}
  `;

  revalidatePath('/finance/employees');
}

// ============================================
// Ledger Entry Actions
// ============================================

/**
 * Add a ledger entry for an employee
 */
export async function addLedgerEntry(input: CreateLedgerEntryInput): Promise<EmployeeLedgerEntry> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.ledger.create');

  // Validate input
  const validated = CreateLedgerEntrySchema.parse(input);

  // Verify employee belongs to tenant
  const empCheck = await sql`
    SELECT id FROM employees 
    WHERE id = ${validated.employeeId} AND tenant_id = ${context.tenantId}
    LIMIT 1
  `;
  const empCheckRows = empCheck as any[];

  if (empCheckRows.length === 0) {
    throw new Error('Çalışan bulunamadı');
  }

  const result = await sql`
    INSERT INTO employee_ledger_entries (
      tenant_id, employee_id, kind, amount, currency, entry_date, note, created_by
    ) VALUES (
      ${context.tenantId},
      ${validated.employeeId},
      ${validated.kind},
      ${validated.amount},
      ${validated.currency || 'TRY'},
      ${validated.entryDate},
      ${validated.note || null},
      ${context.userId}
    )
    RETURNING *
  `;

  revalidatePath('/finance');
  revalidatePath('/finance/employees');
  revalidatePath(`/finance/employees/${validated.employeeId}`);

  const rows = result as any[];
  const row = rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    kind: row.kind,
    amount: parseFloat(row.amount),
    currency: row.currency,
    entryDate: row.entry_date,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * List ledger entries for an employee
 */
export async function listLedgerEntries(
  employeeId: string,
  options?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<EmployeeLedgerEntry[]> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.ledger.view');

  let result;

  if (options?.startDate && options?.endDate) {
    result = await sql`
      SELECT * FROM employee_ledger_entries 
      WHERE tenant_id = ${context.tenantId}
      AND employee_id = ${employeeId}
      AND entry_date >= ${options.startDate}
      AND entry_date <= ${options.endDate}
      ORDER BY entry_date DESC, created_at DESC
    `;
  } else {
    result = await sql`
      SELECT * FROM employee_ledger_entries 
      WHERE tenant_id = ${context.tenantId}
      AND employee_id = ${employeeId}
      ORDER BY entry_date DESC, created_at DESC
    `;
  }

  const rows = result as any[];
  return rows.map((row: any) => ({
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    kind: row.kind,
    amount: parseFloat(row.amount),
    currency: row.currency,
    entryDate: row.entry_date,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

/**
 * Get this month's payroll cost
 * Includes: salary + payment (but NOT advance/deduction as they are not real expenses)
 */
export async function getThisMonthPayrollCost(): Promise<number> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.ledger.view');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split('T')[0];

  const result = await sql`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM employee_ledger_entries
    WHERE tenant_id = ${context.tenantId}
    AND kind IN ('salary', 'payment')
    AND entry_date >= ${startOfMonth}
    AND entry_date <= ${endOfMonth}
  `;

  const rows = result as any[];
  return parseFloat(rows[0]?.total || '0');
}

/**
 * Get employee balance (advances - deductions)
 * Positive = employee owes company (has advance debt)
 * Negative = company owes employee
 */
export async function getEmployeeBalance(employeeId: string): Promise<number> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.ledger.view');

  const result = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN kind = 'advance' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN kind = 'deduction' THEN amount ELSE 0 END), 0) as balance
    FROM employee_ledger_entries
    WHERE tenant_id = ${context.tenantId}
    AND employee_id = ${employeeId}
  `;

  const rows = result as any[];
  return parseFloat(rows[0]?.balance || '0');
}

/**
 * Get employee with balance summary
 */
export async function getEmployeeWithBalance(employeeId: string): Promise<Employee & { balance: number; totalSalary: number; totalAdvance: number }> {
  const context = await getServerUserContext();
  requirePermission(context, 'finance.employees.view');

  const employee = await getEmployeeById(employeeId);
  if (!employee) {
    throw new Error('Çalışan bulunamadı');
  }

  const summaryResult = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN kind = 'salary' THEN amount ELSE 0 END), 0) as total_salary,
      COALESCE(SUM(CASE WHEN kind = 'advance' THEN amount ELSE 0 END), 0) as total_advance,
      COALESCE(SUM(CASE WHEN kind = 'advance' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN kind = 'deduction' THEN amount ELSE 0 END), 0) as balance
    FROM employee_ledger_entries
    WHERE tenant_id = ${context.tenantId}
    AND employee_id = ${employeeId}
  `;

  const summaryRows = summaryResult as any[];
  const summary = summaryRows[0];

  return {
    ...employee,
    balance: parseFloat(summary?.balance || '0'),
    totalSalary: parseFloat(summary?.total_salary || '0'),
    totalAdvance: parseFloat(summary?.total_advance || '0'),
  };
}
