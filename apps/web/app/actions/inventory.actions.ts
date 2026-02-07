'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { withServerActionTiming } from '@/lib/utils/metrics';
import { getServerUserContext, requirePermission } from '@/lib/auth/serverAuth';

export type StockMovementType = 'IN' | 'OUT' | 'ADJUST';

export interface InventoryItemRow {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  unit: string;
  minStock: number;
  location: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  currentStock: number;
}

export interface StockMovementRow {
  id: string;
  tenantId: string;
  itemId: string;
  type: StockMovementType;
  quantity: number;
  orderId: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  itemSku?: string;
  itemName?: string;
}

export interface PaginatedInventoryItems {
  items: InventoryItemRow[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedStockMovements {
  movements: StockMovementRow[];
  total: number;
  page: number;
  limit: number;
}

const CreateInventoryItemSchema = z.object({
  sku: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  unit: z.string().trim().min(1).max(40).default('adet'),
  minStock: z.number().min(0).default(0),
  location: z.string().trim().max(160).optional(),
  active: z.boolean().default(true),
});

const UpdateInventoryItemSchema = z.object({
  sku: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(180).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  minStock: z.number().min(0).optional(),
  location: z.string().trim().max(160).nullable().optional(),
  active: z.boolean().optional(),
});

const ListInventoryItemsSchema = z.object({
  search: z.string().trim().optional(),
  activeOnly: z.boolean().default(false),
  lowStockOnly: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

const CreateStockMovementSchema = z.object({
  itemId: z.string().uuid(),
  type: z.enum(['IN', 'OUT', 'ADJUST']),
  quantity: z.number().positive(),
  orderId: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
});

const ListStockMovementsSchema = z.object({
  itemId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  dateRange: z
    .object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .optional(),
});

function mapInventoryItem(row: Record<string, unknown>): InventoryItemRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sku: String(row.sku),
    name: String(row.name),
    unit: String(row.unit),
    minStock: Number(row.min_stock || 0),
    location: row.location ? String(row.location) : null,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    currentStock: Number(row.current_stock || 0),
  };
}

function mapStockMovement(row: Record<string, unknown>): StockMovementRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    itemId: String(row.item_id),
    type: row.type as StockMovementType,
    quantity: Number(row.quantity),
    orderId: row.order_id ? String(row.order_id) : null,
    note: row.note ? String(row.note) : null,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    itemSku: row.item_sku ? String(row.item_sku) : undefined,
    itemName: row.item_name ? String(row.item_name) : undefined,
  };
}

async function getCurrentStockForItem(tenantId: string, itemId: string): Promise<number> {
  const result = await sql`
    SELECT COALESCE(current_stock, 0) as current_stock
    FROM inventory_item_stocks
    WHERE tenant_id = ${tenantId}
      AND item_id = ${itemId}
    LIMIT 1
  `;

  const rows = result as Array<{ current_stock: string | number }>;
  if (rows.length > 0) return Number(rows[0].current_stock || 0);

  // Fallback for older DBs without stock cache.
  const fallback = await sql`
    SELECT COALESCE(current_stock, 0) as current_stock
    FROM inventory_item_stock_view
    WHERE tenant_id = ${tenantId}
      AND item_id = ${itemId}
    LIMIT 1
  `;
  const fallbackRows = fallback as Array<{ current_stock: string | number }>;
  return Number(fallbackRows[0]?.current_stock || 0);
}

export async function createInventoryItem(input: z.infer<typeof CreateInventoryItemSchema>): Promise<InventoryItemRow> {
  return withServerActionTiming('inventory.createInventoryItem', async () => {
    const context = await getServerUserContext();
    requirePermission(context, 'inventory.edit');

    const validated = CreateInventoryItemSchema.parse(input);

    const result = await sql`
      INSERT INTO inventory_items (
        tenant_id, sku, name, unit, min_stock, location, active
      ) VALUES (
        ${context.tenantId},
        ${validated.sku},
        ${validated.name},
        ${validated.unit || 'adet'},
        ${validated.minStock || 0},
        ${validated.location || null},
        ${validated.active}
      )
      RETURNING *, 0::numeric as current_stock
    `;

    const rows = result as Record<string, unknown>[];
    const item = mapInventoryItem(rows[0]);

    revalidatePath('/inventory');
    return item;
  });
}

export async function updateInventoryItem(
  id: string,
  input: z.infer<typeof UpdateInventoryItemSchema>
): Promise<InventoryItemRow> {
  return withServerActionTiming('inventory.updateInventoryItem', async () => {
    const context = await getServerUserContext();
    requirePermission(context, 'inventory.edit');

    const validated = UpdateInventoryItemSchema.parse(input);

    const result = await sql`
      UPDATE inventory_items
      SET
        sku = COALESCE(${validated.sku}, sku),
        name = COALESCE(${validated.name}, name),
        unit = COALESCE(${validated.unit}, unit),
        min_stock = COALESCE(${validated.minStock}, min_stock),
        location = CASE
          WHEN ${validated.location === null} THEN NULL
          ELSE COALESCE(${validated.location}, location)
        END,
        active = COALESCE(${validated.active}, active),
        updated_at = NOW()
      WHERE id = ${id}
        AND tenant_id = ${context.tenantId}
      RETURNING *
    `;

    const rows = result as Record<string, unknown>[];
    if (rows.length === 0) {
      throw new Error('Envanter kalemi bulunamadı');
    }

    const currentStock = await getCurrentStockForItem(context.tenantId, id);
    const item = mapInventoryItem({ ...rows[0], current_stock: currentStock });

    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
    return item;
  });
}

export async function listInventoryItems(
  input: z.infer<typeof ListInventoryItemsSchema>
): Promise<PaginatedInventoryItems> {
  return withServerActionTiming('inventory.listInventoryItems', async () => {
    const context = await getServerUserContext();
    requirePermission(context, 'inventory.view');

    const validated = ListInventoryItemsSchema.parse(input);
    const offset = (validated.page - 1) * validated.limit;
    const search = validated.search || null;
    const searchLike = search ? `%${search}%` : null;

    const query = sql`
      WITH items_with_stock AS (
        SELECT
          i.*,
          COALESCE(s.current_stock, 0) as current_stock
        FROM inventory_items i
        LEFT JOIN inventory_item_stocks s
          ON s.item_id = i.id
          AND s.tenant_id = i.tenant_id
        WHERE i.tenant_id = ${context.tenantId}
          AND (${validated.activeOnly} = false OR i.active = true)
          AND (
            ${searchLike}::text IS NULL
            OR i.name ILIKE ${searchLike}
            OR i.sku ILIKE ${searchLike}
          )
      )
      SELECT *
      FROM items_with_stock
      WHERE (${validated.lowStockOnly} = false OR current_stock < min_stock)
      ORDER BY updated_at DESC, name ASC
      LIMIT ${validated.limit} OFFSET ${offset}
    `;

    const countQuery = sql`
      WITH items_with_stock AS (
        SELECT
          i.id,
          i.min_stock,
          COALESCE(s.current_stock, 0) as current_stock
        FROM inventory_items i
        LEFT JOIN inventory_item_stocks s
          ON s.item_id = i.id
          AND s.tenant_id = i.tenant_id
        WHERE i.tenant_id = ${context.tenantId}
          AND (${validated.activeOnly} = false OR i.active = true)
          AND (
            ${searchLike}::text IS NULL
            OR i.name ILIKE ${searchLike}
            OR i.sku ILIKE ${searchLike}
          )
      )
      SELECT COUNT(*) as total
      FROM items_with_stock
      WHERE (${validated.lowStockOnly} = false OR current_stock < min_stock)
    `;

    const [itemsResult, totalResult] = await Promise.all([query, countQuery]);

    const itemRows = itemsResult as Record<string, unknown>[];
    const totalRows = totalResult as Array<{ total: string | number }>;

    return {
      items: itemRows.map(mapInventoryItem),
      total: Number(totalRows[0]?.total || 0),
      page: validated.page,
      limit: validated.limit,
    };
  });
}

export async function getInventoryItem(id: string): Promise<InventoryItemRow | null> {
  return withServerActionTiming('inventory.getInventoryItem', async () => {
    const context = await getServerUserContext();
    requirePermission(context, 'inventory.view');

    const result = await sql`
      SELECT
        i.*,
        COALESCE(s.current_stock, 0) as current_stock
      FROM inventory_items i
      LEFT JOIN inventory_item_stocks s
        ON s.item_id = i.id
        AND s.tenant_id = i.tenant_id
      WHERE i.id = ${id}
        AND i.tenant_id = ${context.tenantId}
      LIMIT 1
    `;

    const rows = result as Record<string, unknown>[];
    if (rows.length === 0) return null;

    return mapInventoryItem(rows[0]);
  });
}

export async function createStockMovement(
  input: z.infer<typeof CreateStockMovementSchema>
): Promise<StockMovementRow> {
  return withServerActionTiming('inventory.createStockMovement', async () => {
    const context = await getServerUserContext();
    requirePermission(context, 'inventory.movements.create');

    const validated = CreateStockMovementSchema.parse(input);
    const movement = await withTransaction(async (tx) => {
      const itemCheck = await tx`
        SELECT id FROM inventory_items
        WHERE id = ${validated.itemId}
          AND tenant_id = ${context.tenantId}
        LIMIT 1
      `;
      const itemRows = itemCheck as Array<{ id: string }>;
      if (itemRows.length === 0) {
        throw new Error('Envanter kalemi bulunamadı');
      }

      if (validated.orderId) {
        const orderCheck = await tx`
          SELECT id FROM orders
          WHERE id = ${validated.orderId}
            AND tenant_id = ${context.tenantId}
          LIMIT 1
        `;
        const orderRows = orderCheck as Array<{ id: string }>;
        if (orderRows.length === 0) {
          throw new Error('Sipariş bulunamadı');
        }
      }

      // Ensure stock row exists (new DBs create via trigger; old DBs may not).
      await tx`
        INSERT INTO inventory_item_stocks (tenant_id, item_id, current_stock)
        VALUES (${context.tenantId}, ${validated.itemId}, 0)
        ON CONFLICT (tenant_id, item_id) DO NOTHING
      `;

      // Lock stock row to make OUT checks race-safe.
      const locked = await tx`
        SELECT current_stock
        FROM inventory_item_stocks
        WHERE tenant_id = ${context.tenantId}
          AND item_id = ${validated.itemId}
        FOR UPDATE
      `;
      const lockedRows = locked as Array<{ current_stock: string | number }>;
      const currentStock = Number(lockedRows[0]?.current_stock || 0);

      if (validated.type === 'OUT' && validated.quantity > currentStock) {
        throw new Error('Yetersiz stok');
      }

      const result = await tx`
        INSERT INTO stock_movements (
          tenant_id, item_id, type, quantity, order_id, note, created_by
        ) VALUES (
          ${context.tenantId},
          ${validated.itemId},
          ${validated.type},
          ${validated.quantity},
          ${validated.orderId || null},
          ${validated.note || null},
          ${context.userId}
        )
        RETURNING *
      `;

      const rows = result as Record<string, unknown>[];
      return mapStockMovement(rows[0]);
    });

    revalidatePath('/inventory');
    revalidatePath(`/inventory/${validated.itemId}`);

    return movement;
  });
}

export async function listStockMovements(
  input: z.infer<typeof ListStockMovementsSchema>
): Promise<PaginatedStockMovements> {
  return withServerActionTiming('inventory.listStockMovements', async () => {
    const context = await getServerUserContext();
    requirePermission(context, 'inventory.view');

    const validated = ListStockMovementsSchema.parse(input);
    const offset = (validated.page - 1) * validated.limit;
    const dateFrom = validated.dateRange?.from || null;
    const dateTo = validated.dateRange?.to || null;

    const listQuery = sql`
      SELECT
        sm.*,
        i.sku as item_sku,
        i.name as item_name
      FROM stock_movements sm
      JOIN inventory_items i
        ON i.id = sm.item_id
        AND i.tenant_id = sm.tenant_id
      WHERE sm.tenant_id = ${context.tenantId}
        AND (${validated.itemId || null}::uuid IS NULL OR sm.item_id = ${validated.itemId || null}::uuid)
        AND (${dateFrom}::timestamptz IS NULL OR sm.created_at >= ${dateFrom}::timestamptz)
        AND (${dateTo}::timestamptz IS NULL OR sm.created_at <= ${dateTo}::timestamptz)
      ORDER BY sm.created_at DESC
      LIMIT ${validated.limit} OFFSET ${offset}
    `;

    const countQuery = sql`
      SELECT COUNT(*) as total
      FROM stock_movements sm
      WHERE sm.tenant_id = ${context.tenantId}
        AND (${validated.itemId || null}::uuid IS NULL OR sm.item_id = ${validated.itemId || null}::uuid)
        AND (${dateFrom}::timestamptz IS NULL OR sm.created_at >= ${dateFrom}::timestamptz)
        AND (${dateTo}::timestamptz IS NULL OR sm.created_at <= ${dateTo}::timestamptz)
    `;

    const [listResult, countResult] = await Promise.all([listQuery, countQuery]);

    const movementRows = listResult as Record<string, unknown>[];
    const countRows = countResult as Array<{ total: string | number }>;

    return {
      movements: movementRows.map(mapStockMovement),
      total: Number(countRows[0]?.total || 0),
      page: validated.page,
      limit: validated.limit,
    };
  });
}

// Backward-compatible aliases used by older screens.
export async function getInventoryItems(params?: {
  search?: string;
  lowStock?: boolean;
  limit?: number;
  offset?: number;
  activeOnly?: boolean;
}): Promise<{ items: InventoryItemRow[]; total: number }> {
  const page = params?.offset && params.limit ? Math.floor(params.offset / params.limit) + 1 : 1;
  const limit = params?.limit || 20;

  const result = await listInventoryItems({
    search: params?.search,
    lowStockOnly: params?.lowStock || false,
    activeOnly: params?.activeOnly || false,
    page,
    limit,
  });

  return { items: result.items, total: result.total };
}

export async function getInventoryItemById(itemId: string): Promise<InventoryItemRow | null> {
  return getInventoryItem(itemId);
}

export async function getStockMovements(itemId?: string): Promise<StockMovementRow[]> {
  const result = await listStockMovements({
    itemId,
    page: 1,
    limit: 50,
  });
  return result.movements;
}

export async function getInventorySummary(): Promise<{
  totalItems: number;
  lowStockItems: number;
  activeItems: number;
}> {
  const context = await getServerUserContext();
  requirePermission(context, 'inventory.view');

  const result = await sql`
    WITH items_with_stock AS (
      SELECT
        i.id,
        i.active,
        i.min_stock,
        COALESCE(s.current_stock, 0) as current_stock
      FROM inventory_items i
      LEFT JOIN inventory_item_stocks s
        ON s.item_id = i.id
        AND s.tenant_id = i.tenant_id
      WHERE i.tenant_id = ${context.tenantId}
    )
    SELECT
      COUNT(*) as total_items,
      COUNT(*) FILTER (WHERE active = true) as active_items,
      COUNT(*) FILTER (WHERE current_stock < min_stock) as low_stock_items
    FROM items_with_stock
  `;

  const rows = result as Array<{ total_items: string | number; active_items: string | number; low_stock_items: string | number }>;
  return {
    totalItems: Number(rows[0]?.total_items || 0),
    activeItems: Number(rows[0]?.active_items || 0),
    lowStockItems: Number(rows[0]?.low_stock_items || 0),
  };
}

export async function getStockAlerts(): Promise<InventoryItemRow[]> {
  const result = await listInventoryItems({
    lowStockOnly: true,
    activeOnly: true,
    page: 1,
    limit: 20,
  });
  return result.items;
}
