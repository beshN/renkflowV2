/**
 * @jest-environment node
 *
 * Deterministic unit tests for reserveWorkOrderMaterials / releaseWorkOrderReservation.
 *
 * The service only talks to the database through the `tx` tagged template inside withTransaction,
 * so the transaction module is replaced by a small state machine that:
 *  - records every SQL statement (text + bound values),
 *  - applies INSERT/UPDATE effects to a draft copy of the state,
 *  - commits the draft only when the callback resolves and discards it when it throws,
 *    mirroring what PostgreSQL does with an aborted transaction.
 *
 * Invariants proven here (no database needed):
 *  - every statement is tenant-scoped (predicate + bound tenant id),
 *  - availability is checked before anything is written: a failed reserve leaves zero rows behind,
 *  - active reservations never exceed on-hand stock across sequential work orders,
 *  - an idempotency key replays the first result instead of reserving twice,
 *  - release is idempotent and never subtracts already consumed quantity twice,
 *  - the transaction always runs SERIALIZABLE.
 */
jest.mock('server-only', () => ({}));
// withRetry is passed through (its own retry behaviour is covered in __tests__/lib/db-transaction.test.ts).
jest.mock('@/lib/db/transaction', () => ({ withTransaction: jest.fn(), withRetry: (callback: () => unknown) => callback() }));

import { withTransaction } from '@/lib/db/transaction';
import { reserveWorkOrderMaterials, releaseWorkOrderReservation } from '../reservation.service';

type Row = Record<string, any>;

interface DbState {
  workOrders: Row[];
  materials: Row[];
  balances: Record<string, number>;
  reservations: Row[];
  lines: Row[];
  events: Row[];
}

interface Query {
  text: string;
  values: any[];
}

const TENANT = 'tenant-a';
const OTHER_TENANT = 'tenant-b';
const USER = 'user-1';
const OTHER_USER = 'user-2';
const WO1 = '11111111-1111-4111-8111-111111111111';
const WO2 = '22222222-2222-4222-8222-222222222222';
const ORDER = '33333333-3333-4333-8333-333333333333';
const ITEM = '44444444-4444-4444-8444-444444444444';
const OTHER_ITEM = '55555555-5555-4555-8555-555555555555';
const WH = '66666666-6666-4666-8666-666666666666';
const KEY = 'reserve-key-0001';
const KEY2 = 'reserve-key-0002';

const actor = { tenantId: TENANT, userId: USER };
const otherActor = { tenantId: OTHER_TENANT, userId: OTHER_USER };

const blank = (): DbState => ({ workOrders: [], materials: [], balances: {}, reservations: [], lines: [], events: [] });
const woKey = (tenantId: string, id: string) => `${tenantId}|${id}`;
const balKey = (tenantId: string, itemId: string, warehouseId: string) => `${tenantId}|${itemId}|${warehouseId}`;
const clone = (state: DbState): DbState => JSON.parse(JSON.stringify(state));

const db = { state: blank(), executed: [] as Query[] };

function seedWorkOrder(
  overrides: Partial<Row> = {},
  materials: Array<Partial<Row>> = [{}],
  options: { onHand?: number; balance?: boolean } = {},
) {
  const workOrder: Row = {
    id: WO1,
    tenant_id: TENANT,
    order_id: ORDER,
    status: 'open',
    reservation_status: 'not_reserved',
    ...overrides,
  };
  db.state.workOrders.push(workOrder);
  materials.forEach((material, index) => {
    db.state.materials.push({
      id: `mat-${index + 1}`,
      tenant_id: workOrder.tenant_id,
      work_order_id: workOrder.id,
      item_id: ITEM,
      source_warehouse_id: WH,
      required_qty: 6,
      reserved_qty: 0,
      consumed_qty: 0,
      transferred_qty: 0,
      ...material,
    });
  });
  if (options.balance !== false) {
    db.state.balances[balKey(workOrder.tenant_id, materials[0].item_id || ITEM, materials[0].source_warehouse_id || WH)] = options.onHand ?? 10;
  }
  return workOrder;
}

/** How much of an item is actively reserved by all open reservations. */
function activeReserved(state: DbState, itemId = ITEM, warehouseId = WH): number {
  return state.lines
    .filter((line) => line.item_id === itemId && line.warehouse_id === warehouseId)
    .filter((line) => state.reservations.find((header) => header.id === line.reservation_id)?.status === 'active')
    .reduce((total, line) => total + Number(line.reserved_qty) - Number(line.consumed_qty) - Number(line.released_qty), 0);
}

function findMaterial(id = 'mat-1', state: DbState = db.state): Row {
  const row = state.materials.find((material) => material.id === id);
  if (!row) throw new Error(`material ${id} missing`);
  return row;
}

function findWorkOrder(state: DbState = db.state, id = WO1): Row {
  const row = state.workOrders.find((workOrder) => workOrder.id === id && workOrder.tenant_id === TENANT);
  if (!row) throw new Error(`work order ${id} missing`);
  return row;
}

/** Answers the exact statements the service issues, in the order it issues them. */
async function respond(text: string, values: any[], s: DbState): Promise<Row[]> {
  if (/^SELECT id, work_order_id FROM stock_reservations/.test(text)) {
    const [tenantId, key] = values;
    return s.reservations
      .filter((row) => row.tenant_id === tenantId && row.idempotency_key === key)
      .map((row) => ({ id: row.id, work_order_id: row.work_order_id }));
  }
  if (/^SELECT id, order_id, status, reservation_status FROM work_orders/.test(text)) {
    const [tenantId, id] = values;
    return s.workOrders.filter((row) => row.tenant_id === tenantId && row.id === id);
  }
  if (/^SELECT id, reservation_status FROM work_orders/.test(text)) {
    const [tenantId, id] = values;
    return s.workOrders.filter((row) => row.tenant_id === tenantId && row.id === id);
  }
  if (/^SELECT \* FROM work_order_materials/.test(text)) {
    const [tenantId, workOrderId] = values;
    return s.materials
      .filter((row) => row.tenant_id === tenantId && row.work_order_id === workOrderId)
      .sort((a, b) => String(a.item_id).localeCompare(String(b.item_id)) || String(a.source_warehouse_id).localeCompare(String(b.source_warehouse_id)));
  }
  if (/^INSERT INTO stock_balances/.test(text)) {
    // The 0 in VALUES is a literal: only three values are bound.
    const [tenantId, itemId, warehouseId] = values;
    const key = balKey(tenantId, itemId, warehouseId);
    if (!(key in s.balances)) s.balances[key] = 0;
    return [];
  }
  if (/^SELECT on_hand_qty FROM stock_balances/.test(text)) {
    const [tenantId, itemId, warehouseId] = values;
    return [{ on_hand_qty: s.balances[balKey(tenantId, itemId, warehouseId)] ?? 0 }];
  }
  if (/^SELECT COALESCE\(SUM\(rl\.reserved_qty/.test(text)) {
    const [tenantId, itemId, warehouseId] = values;
    const reserved = s.lines
      .filter((line) => line.tenant_id === tenantId && line.item_id === itemId && line.warehouse_id === warehouseId)
      .filter((line) => s.reservations.find((header) => header.id === line.reservation_id)?.status === 'active')
      .reduce((total, line) => total + Number(line.reserved_qty) - Number(line.consumed_qty) - Number(line.released_qty), 0);
    return [{ qty: reserved }];
  }
  if (/^INSERT INTO stock_reservations \(/.test(text)) {
    // 'active' is written as a SQL literal: tenant, order, work order, key, user are bound.
    const [tenantId, orderId, workOrderId, key, createdBy] = values;
    if (s.reservations.some((row) => row.tenant_id === tenantId && row.idempotency_key === key)) {
      // UNIQUE (tenant_id, idempotency_key) from 012_native_manufacturing.sql
      const error: any = new Error('duplicate key value violates unique constraint "stock_reservations_tenant_id_idempotency_key_key"');
      error.code = '23505';
      throw error;
    }
    const header: Row = {
      id: `res-${s.reservations.length + 1}`,
      tenant_id: tenantId,
      order_id: orderId,
      work_order_id: workOrderId,
      status: 'active',
      idempotency_key: key,
      created_by: createdBy,
    };
    s.reservations.push(header);
    return [header];
  }
  if (/^INSERT INTO stock_reservation_lines \(/.test(text)) {
    const [tenantId, reservationId, itemId, warehouseId, qty] = values;
    if (Number(qty) <= 0) throw new Error('CHECK constraint violation: stock_reservation_lines_reserved_qty_check');
    s.lines.push({ tenant_id: tenantId, reservation_id: reservationId, item_id: itemId, warehouse_id: warehouseId, reserved_qty: Number(qty), consumed_qty: 0, released_qty: 0 });
    return [];
  }
  if (/^UPDATE work_order_materials SET reserved_qty = reserved_qty \+ /.test(text)) {
    const [qty, tenantId, id] = values;
    const material = s.materials.find((row) => row.id === id && row.tenant_id === tenantId);
    if (material) material.reserved_qty = Number(material.reserved_qty) + Number(qty);
    return [];
  }
  if (/^UPDATE work_order_materials SET reserved_qty = consumed_qty/.test(text)) {
    const [tenantId, workOrderId] = values;
    for (const material of s.materials.filter((row) => row.tenant_id === tenantId && row.work_order_id === workOrderId)) {
      material.reserved_qty = Number(material.consumed_qty);
    }
    return [];
  }
  if (/^UPDATE work_orders SET reservation_status = 'reserved'/.test(text)) {
    const [tenantId, id] = values;
    const workOrder = s.workOrders.find((row) => row.tenant_id === tenantId && row.id === id);
    if (workOrder) workOrder.reservation_status = 'reserved';
    return [];
  }
  if (/^UPDATE work_orders SET reservation_status = 'released'/.test(text)) {
    const [tenantId, id] = values;
    const workOrder = s.workOrders.find((row) => row.tenant_id === tenantId && row.id === id);
    if (workOrder) workOrder.reservation_status = 'released';
    return [];
  }
  if (/^INSERT INTO work_order_events/.test(text)) {
    // 'materials_reserved' is a literal; the payload expression binds one value.
    const [tenantId, workOrderId, payload] = values;
    s.events.push({ tenant_id: tenantId, work_order_id: workOrderId, event_type: 'materials_reserved', payload });
    return [];
  }
  if (/^SELECT \* FROM stock_reservations/.test(text)) {
    const [tenantId, id] = values;
    return s.reservations.filter((row) => row.tenant_id === tenantId && row.id === id);
  }
  if (/^SELECT \* FROM stock_reservation_lines/.test(text)) {
    const [tenantId, reservationId] = values;
    return s.lines.filter((row) => row.tenant_id === tenantId && row.reservation_id === reservationId);
  }
  if (/^SELECT id FROM stock_reservations/.test(text)) {
    const [tenantId, workOrderId] = values;
    return s.reservations.filter((row) => row.tenant_id === tenantId && row.work_order_id === workOrderId && row.status === 'active');
  }
  if (/^UPDATE stock_reservation_lines SET released_qty/.test(text)) {
    const [tenantId, reservationId] = values;
    for (const line of s.lines.filter((row) => row.tenant_id === tenantId && row.reservation_id === reservationId)) {
      line.released_qty = Number(line.reserved_qty) - Number(line.consumed_qty);
    }
    return [];
  }
  if (/^UPDATE stock_reservations SET status = 'released'/.test(text)) {
    const [tenantId, id] = values;
    const header = s.reservations.find((row) => row.tenant_id === tenantId && row.id === id);
    if (header) header.status = 'released';
    return [];
  }
  throw new Error(`fake tx has no rule for: ${text}`);
}

function fakeTx(s: DbState) {
  return (strings: TemplateStringsArray, ...values: any[]): Promise<Row[]> => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    db.executed.push({ text, values });
    return respond(text, values, s);
  };
}

/**
 * Stands in for withTransaction: the callback writes into a draft state, the draft replaces the
 * real state only when the callback resolves. A throw therefore behaves like a PostgreSQL
 * rollback: no header, no line, no status change survives.
 */
function installTransactionRunner() {
  (withTransaction as unknown as jest.Mock).mockImplementation(async (callback: any, options: any) => {
    if (options?.isolationLevel !== 'SERIALIZABLE') {
      throw new Error(`reservation must run SERIALIZABLE, got ${options?.isolationLevel}`);
    }
    const draft = clone(db.state);
    try {
      const result = await callback({ sql: fakeTx(draft), rollback: () => { throw new Error('Transaction rolled back'); } });
      db.state = draft;
      return result;
    } catch (error) {
      throw error;
    }
  });
}

beforeEach(() => {
  process.env.NATIVE_INVENTORY_ENABLED = '1';
  db.state = blank();
  db.executed = [];
  installTransactionRunner();
});

describe('reserveWorkOrderMaterials', () => {
  it('reserves the full shortfall, records header, lines and event, and reports the reservation back', async () => {
    seedWorkOrder({}, [{}], { onHand: 10 });
    const reservation: any = await reserveWorkOrderMaterials(actor, WO1, KEY);

    expect(reservation).toMatchObject({ id: 'res-1', status: 'active', idempotency_key: KEY, work_order_id: WO1 });
    expect(reservation.lines).toHaveLength(1);
    expect(reservation.lines[0]).toMatchObject({ item_id: ITEM, warehouse_id: WH, reserved_qty: 6 });
    expect(findWorkOrder().reservation_status).toBe('reserved');
    expect(findMaterial().reserved_qty).toBe(6);
    expect(db.state.events.map((event) => event.event_type)).toEqual(['materials_reserved']);
    expect(activeReserved(db.state)).toBe(6);
    expect(withTransaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'SERIALIZABLE' });
  });

  it('binds the tenant id in every statement and never mentions another tenant', async () => {
    seedWorkOrder({}, [{}, { item_id: OTHER_ITEM, required_qty: 2, source_warehouse_id: WH }], { onHand: 10 });
    db.state.balances[balKey(TENANT, OTHER_ITEM, WH)] = 5;
    await reserveWorkOrderMaterials(actor, WO1, KEY);
    seedWorkOrder({ id: WO2, order_id: null }, [{}], { balance: false });
    await releaseWorkOrderReservation(actor, WO1);

    expect(db.executed.length).toBeGreaterThan(8);
    for (const query of db.executed) {
      expect(query.text).toContain('tenant_id');
      expect(query.values).toContain(TENANT);
      expect(query.text).not.toContain(OTHER_TENANT);
      expect(query.values).not.toContain(OTHER_TENANT);
    }
  });

  it('replays an idempotency key instead of reserving twice', async () => {
    seedWorkOrder();
    const first: any = await reserveWorkOrderMaterials(actor, WO1, KEY);
    db.executed = [];
    const second: any = await reserveWorkOrderMaterials(actor, WO1, KEY);

    expect(second.id).toBe(first.id);
    expect(db.state.reservations).toHaveLength(1);
    expect(db.state.lines).toHaveLength(1);
    expect(findMaterial().reserved_qty).toBe(6);
    expect(db.state.events).toHaveLength(1);
    // The replay path may only read: no INSERT/UPDATE is allowed after the key is found.
    expect(db.executed.some((query) => /^(INSERT|UPDATE)/.test(query.text))).toBe(false);
    expect(db.executed.map((query) => query.text)).toEqual([
      expect.stringContaining('SELECT id, work_order_id FROM stock_reservations'),
      expect.stringContaining('SELECT * FROM stock_reservations'),
      expect.stringContaining('SELECT * FROM stock_reservation_lines'),
    ]);
  });

  it('refuses a key already used by another work order', async () => {
    seedWorkOrder();
    await reserveWorkOrderMaterials(actor, WO1, KEY);
    seedWorkOrder({ id: WO2 }, [{}], { balance: false });

    await expect(reserveWorkOrderMaterials(actor, WO2, KEY)).rejects.toThrow('farklı bir rezervasyonda');
    expect(db.state.reservations).toHaveLength(1);
    expect(activeReserved(db.state)).toBe(6);
  });

  it('rejects a key shorter than 8 characters before opening a transaction', async () => {
    seedWorkOrder();
    await expect(reserveWorkOrderMaterials(actor, WO1, 'short')).rejects.toThrow('idempotency anahtarı');
    expect(withTransaction).not.toHaveBeenCalled();
    expect(db.executed).toHaveLength(0);
  });

  it('refuses to run while the native inventory engine is off', async () => {
    delete process.env.NATIVE_INVENTORY_ENABLED;
    seedWorkOrder();
    await expect(reserveWorkOrderMaterials(actor, WO1, KEY)).rejects.toThrow('Native stok motoru kapalı');
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it.each(['done', 'cancelled'])('refuses a %s work order', async (status) => {
    seedWorkOrder({ status });
    await expect(reserveWorkOrderMaterials(actor, WO1, KEY)).rejects.toThrow('Kapalı üretim emri rezerve edilemez');
    expect(db.state.reservations).toHaveLength(0);
    expect(db.state.events).toHaveLength(0);
  });

  it('refuses a work order of another tenant as if it did not exist', async () => {
    seedWorkOrder();
    await expect(reserveWorkOrderMaterials(otherActor, WO1, KEY)).rejects.toThrow('Üretim emri bulunamadı');
    expect(db.state.reservations).toHaveLength(0);
    expect(db.executed.every((query) => !query.values.includes(TENANT))).toBe(true);
    expect(db.executed.every((query) => query.values.includes(OTHER_TENANT))).toBe(true);
  });

  it('refuses a work order without materials', async () => {
    seedWorkOrder({}, [], { balance: false });
    await expect(reserveWorkOrderMaterials(actor, WO1, KEY)).rejects.toThrow('malzeme bulunmuyor');
    expect(db.state.reservations).toHaveLength(0);
  });

  it('refuses to reserve more than is available and leaves nothing behind (atomicity)', async () => {
    seedWorkOrder({}, [{}], { onHand: 5 });

    await expect(reserveWorkOrderMaterials(actor, WO1, KEY)).rejects.toThrow('Yetersiz kullanılabilir stok');
    // Availability was checked before the first write: nothing may survive the abort.
    expect(db.state.reservations).toHaveLength(0);
    expect(db.state.lines).toHaveLength(0);
    expect(db.state.events).toHaveLength(0);
    expect(findMaterial().reserved_qty).toBe(0);
    expect(findWorkOrder().reservation_status).toBe('not_reserved');
  });

  it('aborts on a short second material even though the first one was fine', async () => {
    seedWorkOrder({}, [{}, { item_id: OTHER_ITEM, required_qty: 99, source_warehouse_id: WH }], { onHand: 10 });
    db.state.balances[balKey(TENANT, OTHER_ITEM, WH)] = 1;

    await expect(reserveWorkOrderMaterials(actor, WO1, KEY)).rejects.toThrow('Yetersiz kullanılabilir stok');
    expect(db.state.reservations).toHaveLength(0);
    expect(db.state.lines).toHaveLength(0);
    expect(findMaterial('mat-1').reserved_qty).toBe(0);
    expect(findMaterial('mat-2').reserved_qty).toBe(0);
    expect(findWorkOrder().reservation_status).toBe('not_reserved');
  });

  it('accepts exactly what is free and never lets active reservations pass the on-hand stock', async () => {
    const WO3 = '77777777-7777-4777-8777-777777777777';
    const WO4 = '88888888-8888-4888-8888-888888888888';
    seedWorkOrder({}, [{}], { onHand: 10 }); // WO1 takes 6 of 10
    await reserveWorkOrderMaterials(actor, WO1, KEY);
    expect(activeReserved(db.state)).toBe(6);

    // 4 left: 5 must fail...
    seedWorkOrder({ id: WO2, order_id: null }, [{ required_qty: 5 }], { balance: false });
    await expect(reserveWorkOrderMaterials(actor, WO2, KEY2)).rejects.toThrow('Yetersiz kullanılabilir stok');
    expect(activeReserved(db.state)).toBe(6);
    expect(db.state.reservations).toHaveLength(1);

    // ...4 must succeed...
    seedWorkOrder({ id: WO3, order_id: null }, [{ required_qty: 4 }], { balance: false });
    await reserveWorkOrderMaterials(actor, WO3, 'reserve-key-0003');
    expect(activeReserved(db.state)).toBe(10);
    expect(activeReserved(db.state)).toBeLessThanOrEqual(db.state.balances[balKey(TENANT, ITEM, WH)]);

    // ...and a fourth work order has nothing left.
    seedWorkOrder({ id: WO4, order_id: null }, [{ required_qty: 1 }], { balance: false });
    await expect(reserveWorkOrderMaterials(actor, WO4, 'reserve-key-0004')).rejects.toThrow('Yetersiz kullanılabilir stok');
    expect(activeReserved(db.state)).toBe(10);
    expect(db.state.reservations).toHaveLength(2);
  });

  it('skips materials that are already fully reserved instead of reserving them twice', async () => {
    seedWorkOrder({ reservation_status: 'reserved' }, [{ reserved_qty: 6, required_qty: 6 }], { onHand: 10 });
    await reserveWorkOrderMaterials(actor, WO1, KEY);

    expect(db.state.lines).toHaveLength(0);
    expect(findMaterial().reserved_qty).toBe(6);
    expect(activeReserved(db.state)).toBe(0);
  });

  it.failing('does not downgrade a transferred work order back to reserved (defect: reserve has no reservation_status guard)', async () => {
    // Materials already moved to WIP: a second reserve with a fresh key must not rewrite the state.
    seedWorkOrder({ reservation_status: 'transferred' }, [{ reserved_qty: 6, required_qty: 6 }], { onHand: 0 });
    await expect(reserveWorkOrderMaterials(actor, WO1, KEY2)).rejects.toThrow();
    expect(findWorkOrder().reservation_status).toBe('transferred');
    expect(db.state.reservations).toHaveLength(0);
  });
});

describe('releaseWorkOrderReservation', () => {
  it('releases every active reservation line and frees the work order for a new reserve', async () => {
    seedWorkOrder();
    await reserveWorkOrderMaterials(actor, WO1, KEY);

    const result: any = await releaseWorkOrderReservation(actor, WO1);
    expect(result).toEqual({ released: true, workOrderId: WO1 });
    expect(db.state.reservations[0].status).toBe('released');
    expect(db.state.lines[0].released_qty).toBe(6);
    expect(findMaterial().reserved_qty).toBe(0);
    expect(findWorkOrder().reservation_status).toBe('released');
    expect(activeReserved(db.state)).toBe(0);

    // Freed stock can be reserved again under a new key.
    await reserveWorkOrderMaterials(actor, WO1, KEY2);
    expect(activeReserved(db.state)).toBe(6);
  });

  it('is idempotent: a repeated release changes nothing', async () => {
    seedWorkOrder();
    await reserveWorkOrderMaterials(actor, WO1, KEY);
    await releaseWorkOrderReservation(actor, WO1);
    const snapshot = JSON.stringify(db.state);

    db.executed = [];
    const again: any = await releaseWorkOrderReservation(actor, WO1);
    expect(again).toEqual({ released: true, workOrderId: WO1 });
    expect(JSON.stringify(db.state)).toBe(snapshot);
    // The second pass finds no active reservation: only the two unconditional statements run.
    expect(db.executed.map((query) => query.text)).toEqual([
      expect.stringContaining('SELECT id, reservation_status FROM work_orders'),
      expect.stringContaining("SELECT id FROM stock_reservations"),
      expect.stringContaining('UPDATE work_order_materials SET reserved_qty = consumed_qty'),
      expect.stringContaining("UPDATE work_orders SET reservation_status = 'released'"),
    ]);
  });

  it('never releases more than what is left after consumption', async () => {
    seedWorkOrder();
    await reserveWorkOrderMaterials(actor, WO1, KEY);
    // The production run consumed 2 of the 6 reserved units.
    db.state.lines[0].consumed_qty = 2;
    findMaterial().consumed_qty = 2;

    await releaseWorkOrderReservation(actor, WO1);
    expect(db.state.lines[0].released_qty).toBe(4); // 6 reserved - 2 consumed
    expect(db.state.lines[0].consumed_qty).toBe(2);
    expect(findMaterial().reserved_qty).toBe(2); // reserved collapses to consumed, never below
    expect(db.state.lines[0].consumed_qty + db.state.lines[0].released_qty).toBe(db.state.lines[0].reserved_qty);
  });

  it('refuses an unknown work order and writes nothing', async () => {
    seedWorkOrder();
    await expect(releaseWorkOrderReservation(actor, '99999999-9999-4999-8999-999999999999')).rejects.toThrow('Üretim emri bulunamadı');
    expect(db.executed).toHaveLength(1);
    expect(db.state.reservations).toHaveLength(0);
  });

  it('refuses a work order of another tenant', async () => {
    seedWorkOrder();
    await reserveWorkOrderMaterials(actor, WO1, KEY);
    db.executed = [];
    await expect(releaseWorkOrderReservation(otherActor, WO1)).rejects.toThrow('Üretim emri bulunamadı');
    expect(db.state.reservations[0].status).toBe('active');
    expect(db.executed).toHaveLength(1);
    expect(db.executed[0].values).toContain(OTHER_TENANT);
    expect(db.executed[0].values).not.toContain(TENANT);
  });

  it('refuses while the native inventory engine is off', async () => {
    delete process.env.NATIVE_INVENTORY_ENABLED;
    await expect(releaseWorkOrderReservation(actor, WO1)).rejects.toThrow('Native stok motoru kapalı');
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it.failing('refuses to release after the materials were transferred to WIP (defect: release has no reservation_status guard)', async () => {
    // Transfer already moved the physical stock: a plain release drops the reservations,
    // leaves the goods in the WIP warehouse and makes the job uncompletable afterwards.
    seedWorkOrder({ reservation_status: 'transferred' });
    await reserveWorkOrderMaterials(actor, WO1, KEY);
    db.state.workOrders.find((workOrder) => workOrder.id === WO1)!.reservation_status = 'transferred';
    db.state.lines[0].warehouse_id = WH; // transfer rewires the line to the WIP warehouse

    await expect(releaseWorkOrderReservation(actor, WO1)).rejects.toThrow();
    expect(findWorkOrder().reservation_status).toBe('transferred');
    expect(db.state.reservations[0].status).toBe('active');
  });
});
