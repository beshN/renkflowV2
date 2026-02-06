'use server';

/**
 * Inventory Management Server Actions
 * Stok ve envanter yönetimi için server actions
 */

import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { normalizeCurrencyInput } from '@/lib/utils/currency';
import { 
  InventoryItemSchema, 
  StockMovementSchema,
  CreateInventoryItemSchema,
  CreateStockMovementSchema,
  type InventoryItem,
  type StockMovement,
  type StockAlert,
  type InventorySummary,
  INVENTORY_CATEGORY_LABELS,
} from '@/lib/types/inventory';

// ============================================
// Helper Functions
// ============================================

async function getSession() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    throw new Error('Yetkilendirme gerekli');
  }
  return session;
}

// ============================================
// Inventory Items
// ============================================

export async function getInventoryItems(params?: {
  category?: string;
  search?: string;
  lowStock?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: InventoryItem[]; total: number }> {
  try {
    const session = await getSession();
    const { category, search, lowStock, limit = 50, offset = 0 } = params || {};

    let items;
    let countResult;

    if (category) {
      items = await sql`
        SELECT * FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
          AND category = ${category}
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
          AND category = ${category}
      `;
    } else if (search) {
      const searchPattern = `%${search}%`;
      items = await sql`
        SELECT * FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
          AND (name ILIKE ${searchPattern} OR sku ILIKE ${searchPattern})
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
          AND (name ILIKE ${searchPattern} OR sku ILIKE ${searchPattern})
      `;
    } else if (lowStock) {
      items = await sql`
        SELECT * FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
          AND current_stock <= min_stock_level
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
          AND current_stock <= min_stock_level
      `;
    } else {
      items = await sql`
        SELECT * FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
      `;
    }

    const itemsRows = items as any[];
    const countRows = countResult as any[];

    return {
      items: itemsRows.map(mapInventoryItem),
      total: parseInt(countRows[0]?.total || '0'),
    };
  } catch (error) {
    console.error('[Inventory] Get items error:', error);
    return { items: [], total: 0 };
  }
}

export async function getInventoryItemById(itemId: string): Promise<InventoryItem | null> {
  try {
    const session = await getSession();

    const result = await sql`
      SELECT * FROM inventory_items
      WHERE id = ${itemId}
        AND tenant_id = ${session.user.tenantId}
      LIMIT 1
    `;

    const resultRows = result as any[];
    if (resultRows.length === 0) return null;
    return mapInventoryItem(resultRows[0]);
  } catch (error) {
    console.error('[Inventory] Get item by id error:', error);
    return null;
  }
}

export async function createInventoryItem(
  data: z.infer<typeof CreateInventoryItemSchema>
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  try {
    const session = await getSession();
    const validated = CreateInventoryItemSchema.parse(data);

    // Check SKU uniqueness
    const existing = await sql`
      SELECT id FROM inventory_items
      WHERE sku = ${validated.sku}
        AND tenant_id = ${session.user.tenantId}
      LIMIT 1
    `;

    const existingRows = existing as any[];
    if (existingRows.length > 0) {
      return { success: false, error: 'Bu stok kodu zaten kullanılıyor' };
    }

    const result = await sql`
      INSERT INTO inventory_items (
        tenant_id,
        sku,
        name,
        description,
        category,
        unit,
        current_stock,
        min_stock_level,
        max_stock_level,
        reorder_point,
        warehouse_id,
        location,
        unit_cost,
        selling_price,
        supplier_id,
        supplier_name,
        barcode,
        is_trackable,
        is_active
      ) VALUES (
        ${session.user.tenantId},
        ${validated.sku},
        ${validated.name},
        ${validated.description || null},
        ${validated.category},
        ${validated.unit},
        0,
        ${validated.minStockLevel},
        ${validated.maxStockLevel || null},
        ${validated.reorderPoint},
        ${validated.warehouseId || null},
        ${validated.location || null},
        ${validated.unitCost},
        ${validated.sellingPrice || null},
        ${validated.supplierId || null},
        ${validated.supplierName || null},
        ${validated.barcode || null},
        ${validated.isTrackable},
        true
      )
      RETURNING *
    `;

    revalidatePath('/inventory');
    
    return {
      success: true,
      item: mapInventoryItem((result as any[])[0]),
    };
  } catch (error) {
    console.error('[Inventory] Create item error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Stok kalemi oluşturulamadı',
    };
  }
}

export async function updateInventoryItem(
  itemId: string,
  data: Partial<z.infer<typeof CreateInventoryItemSchema>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();

    const result = await sql`
      UPDATE inventory_items
      SET
        name = COALESCE(${data.name}, name),
        description = COALESCE(${data.description}, description),
        category = COALESCE(${data.category}, category),
        unit = COALESCE(${data.unit}, unit),
        min_stock_level = COALESCE(${data.minStockLevel}, min_stock_level),
        max_stock_level = COALESCE(${data.maxStockLevel}, max_stock_level),
        reorder_point = COALESCE(${data.reorderPoint}, reorder_point),
        location = COALESCE(${data.location}, location),
        unit_cost = COALESCE(${data.unitCost}, unit_cost),
        selling_price = COALESCE(${data.sellingPrice}, selling_price),
        supplier_id = COALESCE(${data.supplierId}, supplier_id),
        supplier_name = COALESCE(${data.supplierName}, supplier_name),
        barcode = COALESCE(${data.barcode}, barcode),
        is_trackable = COALESCE(${data.isTrackable}, is_trackable),
        updated_at = NOW()
      WHERE id = ${itemId}
        AND tenant_id = ${session.user.tenantId}
      RETURNING id
    `;

    if ((result as any[]).length === 0) {
      return { success: false, error: 'Stok kalemi bulunamadı' };
    }

    revalidatePath('/inventory');
    return { success: true };
  } catch (error) {
    console.error('[Inventory] Update item error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Güncelleme başarısız',
    };
  }
}

// ============================================
// Stock Movements
// ============================================

export async function createStockMovement(
  data: z.infer<typeof CreateStockMovementSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    const validated = CreateStockMovementSchema.parse(data);

    // Get current stock
    const item = await sql`
      SELECT current_stock FROM inventory_items
      WHERE id = ${validated.itemId}
        AND tenant_id = ${session.user.tenantId}
      LIMIT 1
    `;

    const itemRows = item as any[];
    if (itemRows.length === 0) {
      return { success: false, error: 'Stok kalemi bulunamadı' };
    }

    const currentStock = itemRows[0].current_stock;
    const newStock = currentStock + validated.quantity;

    // Validate stock won't go negative
    if (newStock < 0) {
      return { success: false, error: 'Yetersiz stok miktarı' };
    }

    // Create movement and update stock in transaction
    await sql`
      WITH movement AS (
        INSERT INTO stock_movements (
          tenant_id,
          item_id,
          type,
          quantity,
          unit_price,
          total_price,
          order_id,
          order_number,
          invoice_number,
          from_location,
          to_location,
          batch_number,
          expiry_date,
          reason,
          notes,
          created_by,
          created_by_name
        ) VALUES (
          ${session.user.tenantId},
          ${validated.itemId},
          ${validated.type},
          ${validated.quantity},
          ${validated.unitPrice || null},
          ${validated.unitPrice ? validated.unitPrice * Math.abs(validated.quantity) : null},
          ${validated.orderId || null},
          ${validated.orderNumber || null},
          ${validated.invoiceNumber || null},
          ${validated.fromLocation || null},
          ${validated.toLocation || null},
          ${validated.batchNumber || null},
          ${validated.expiryDate || null},
          ${validated.reason || null},
          ${validated.notes || null},
          ${session.user.id},
          ${session.user.name || session.user.email}
        )
      )
      UPDATE inventory_items
      SET 
        current_stock = ${newStock},
        last_movement_at = NOW(),
        updated_at = NOW()
      WHERE id = ${validated.itemId}
        AND tenant_id = ${session.user.tenantId}
    `;

    revalidatePath('/inventory');
    revalidatePath(`/inventory/${validated.itemId}`);
    
    return { success: true };
  } catch (error) {
    console.error('[Inventory] Create movement error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Hareket kaydedilemedi',
    };
  }
}

export async function getStockMovements(itemId?: string): Promise<StockMovement[]> {
  try {
    const session = await getSession();

    const movements = itemId
      ? await sql`
          SELECT * FROM stock_movements
          WHERE tenant_id = ${session.user.tenantId}
            AND item_id = ${itemId}
          ORDER BY created_at DESC
          LIMIT 50
        `
      : await sql`
          SELECT * FROM stock_movements
          WHERE tenant_id = ${session.user.tenantId}
          ORDER BY created_at DESC
          LIMIT 50
        `;

    const movementsRows = movements as any[];
    return movementsRows.map(mapStockMovement);
  } catch (error) {
    console.error('[Inventory] Get movements error:', error);
    return [];
  }
}

// ============================================
// Reports & Analytics
// ============================================

export async function getInventorySummary(): Promise<InventorySummary> {
  try {
    const session = await getSession();

    const [totals, categoryBreakdown] = await Promise.all([
      sql`
        SELECT 
          COUNT(*) as total_items,
          COALESCE(SUM(current_stock * unit_cost), 0) as total_value,
          COUNT(*) FILTER (WHERE current_stock <= min_stock_level AND current_stock > 0) as low_stock,
          COUNT(*) FILTER (WHERE current_stock = 0) as out_of_stock
        FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
          AND is_active = true
      `,
      sql`
        SELECT category, COUNT(*) as count
        FROM inventory_items
        WHERE tenant_id = ${session.user.tenantId}
          AND is_active = true
        GROUP BY category
      `,
    ]);

    const categoryMap: InventorySummary['categoryBreakdown'] = {} as InventorySummary['categoryBreakdown'];
    (categoryBreakdown as { category: string; count: string }[]).forEach((row) => {
      categoryMap[row.category as keyof typeof categoryMap] = parseInt(row.count);
    });

    const totalsRows = totals as any[];
    return {
      totalItems: parseInt(totalsRows[0]?.total_items || '0'),
      totalValue: parseFloat(totalsRows[0]?.total_value || '0'),
      lowStockItems: parseInt(totalsRows[0]?.low_stock || '0'),
      outOfStockItems: parseInt(totalsRows[0]?.out_of_stock || '0'),
      categoryBreakdown: categoryMap,
    };
  } catch (error) {
    console.error('[Inventory] Get summary error:', error);
    return {
      totalItems: 0,
      totalValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      categoryBreakdown: {} as InventorySummary['categoryBreakdown'],
    };
  }
}

export async function getStockAlerts(): Promise<StockAlert[]> {
  try {
    const session = await getSession();

    const alerts = await sql`
      SELECT 
        id as item_id,
        name as item_name,
        sku,
        current_stock,
        min_stock_level,
        (min_stock_level - current_stock) as shortage_amount,
        CASE 
          WHEN current_stock = 0 THEN 'critical'
          ELSE 'warning'
        END as severity
      FROM inventory_items
      WHERE tenant_id = ${session.user.tenantId}
        AND is_active = true
        AND current_stock <= min_stock_level
      ORDER BY (min_stock_level - current_stock) DESC
      LIMIT 20
    `;

    const alertsRows = alerts as any[];
    return alertsRows.map((row: Record<string, unknown>) => ({
      itemId: row.item_id as string,
      itemName: row.item_name as string,
      sku: row.sku as string,
      currentStock: parseInt(row.current_stock as string),
      minStockLevel: parseInt(row.min_stock_level as string),
      shortageAmount: parseInt(row.shortage_amount as string),
      severity: row.severity as 'critical' | 'warning',
    }));
  } catch (error) {
    console.error('[Inventory] Get alerts error:', error);
    return [];
  }
}

// ============================================
// Helper Functions
// ============================================

function mapInventoryItem(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    sku: row.sku as string,
    name: row.name as string,
    description: row.description as string | undefined,
    category: row.category as InventoryItem['category'],
    unit: row.unit as InventoryItem['unit'],
    currentStock: parseInt(row.current_stock as string) || 0,
    minStockLevel: parseInt(row.min_stock_level as string) || 0,
    maxStockLevel: row.max_stock_level ? parseInt(row.max_stock_level as string) : undefined,
    reorderPoint: parseInt(row.reorder_point as string) || 0,
    warehouseId: row.warehouse_id as string | undefined,
    location: row.location as string | undefined,
    unitCost: parseFloat(row.unit_cost as string) || 0,
    sellingPrice: row.selling_price ? parseFloat(row.selling_price as string) : undefined,
    currency: normalizeCurrencyInput(row.currency),
    supplierId: row.supplier_id as string | undefined,
    supplierName: row.supplier_name as string | undefined,
    supplierSku: row.supplier_sku as string | undefined,
    barcode: row.barcode as string | undefined,
    qrCode: row.qr_code as string | undefined,
    dimensions: row.dimensions as InventoryItem['dimensions'],
    isActive: row.is_active as boolean,
    isTrackable: row.is_trackable as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastMovementAt: row.last_movement_at as string | undefined,
  };
}

function mapStockMovement(row: Record<string, unknown>): StockMovement {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    itemId: row.item_id as string,
    type: row.type as StockMovement['type'],
    quantity: parseInt(row.quantity as string),
    unitPrice: row.unit_price ? parseFloat(row.unit_price as string) : undefined,
    totalPrice: row.total_price ? parseFloat(row.total_price as string) : undefined,
    orderId: row.order_id as string | undefined,
    orderNumber: row.order_number as string | undefined,
    invoiceNumber: row.invoice_number as string | undefined,
    fromLocation: row.from_location as string | undefined,
    toLocation: row.to_location as string | undefined,
    batchNumber: row.batch_number as string | undefined,
    expiryDate: row.expiry_date as string | undefined,
    reason: row.reason as string | undefined,
    notes: row.notes as string | undefined,
    createdBy: row.created_by as string | undefined,
    createdByName: row.created_by_name as string | undefined,
    createdAt: row.created_at as string,
  };
}
