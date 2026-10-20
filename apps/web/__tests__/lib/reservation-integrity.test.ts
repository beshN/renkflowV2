/**
 * @jest-environment node
 *
 * Reservation service integrity (unit level, scripted SQL client — no database).
 *
 * Complements scripts/test-reservation-integrity.ts, which proves the same invariants against a
 * real PostgreSQL. These tests pin down what the service itself guarantees without a database:
 *   - the idempotency guard runs before any SQL,
 *   - every statement is bound to the caller's tenant,
 *   - the availability loop validates each material independently and only writes after the loop
 *     (characterisation: with two rows sharing one stock bucket the loop would happily
 *     over-allocate — the schema's UNIQUE (tenant_id, work_order_id, item_id,
 *     source_warehouse_id) from 012_native_manufacturing.sql is what makes that impossible,
 *     which the integration script asserts against the live database),
 *   - release arithmetic: released = reserved - consumed, material reserved = consumed.
 */
jest.mock('server-only', () => ({}));

process.env.NATIVE_INVENTORY_ENABLED = '1';

jest.mock('@/lib/db', () => {
  let current: any = null;
  return {
    __setCurrentClient: (client: any) => {
      current = client;
    },
    getSql: () => current,
  };
});

import { reserveWorkOrderMaterials, releaseWorkOrderReservation } from '@/lib/features/manufacturing/reservation.service';

const __setCurrentClient = (client: unknown): void => {
  (jest.requireMock('@/lib/db') as { __setCurrentClient: (c: unknown) => void }).__setCurrentClient(client);
};

const TENANT = 'aaaaaaaa-1111-4000-8000-000000000001';
const ACTOR = { tenantId: TENANT, userId: 'user-1', role: 'owner' } as any;
const WO = 'bbbbbbbb-1111-4000-8000-000000000002';
const ITEM = 'cccccccc-1111-4000-8000-000000000003';
const WAREHOUSE = 'dddddddd-1111-4000-8000-000000000004';
const ORDER = 'eeeeeeee-1111-4000-8000-000000000005';

type Row = Record<string, any>;
type Handler = { match: RegExp; rows: Row[] | (() => Row[]) };
type Call = { text: string; values: unknown[] };

type FakeClient = {
  recorder: { executed: string[]; unsafeCalls: string[]; calls: Call[]; handlers: Handler[] };
  begin: (cb: (tx: FakeClient) => Promise<unknown>) => Promise<unknown>;
  unsafe: (query: string, params?: unknown[]) => Promise<Row[]>;
} & ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>);

function createClient(handlers: Handler[] = []): FakeClient {
  const recorder = { executed: [] as string[], unsafeCalls: [] as string[], calls: [] as Call[], handlers };
  async function raw(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
    const text = strings
      .reduce((acc, part, i) => acc + part + (i < values.length ? ` $${i}` : ''), '')
      .replace(/\s+/g, ' ')
      .trim();
    recorder.executed.push(text);
    recorder.calls.push({ text, values });
    for (const handler of recorder.handlers) {
      if (handler.match.test(text)) return typeof handler.rows === 'function' ? handler.rows() : handler.rows;
    }
    throw new Error(`FAKE SQL CLIENT: unhandled query: ${text}`);
  }
  const client = Object.assign(raw as any, {
    recorder,
    begin: async (cb: (tx: FakeClient) => Promise<unknown>) => cb(client as FakeClient),
    unsafe: async (query: string) => {
      recorder.unsafeCalls.push(query);
      return [];
    },
  });
  return client as FakeClient;
}

const reserveHappyPath = (): Handler[] => [
  { match: /SELECT id, work_order_id FROM stock_reservations/, rows: [] },
  { match: /FROM work_orders .* FOR UPDATE/, rows: [{ id: WO, order_id: ORDER, status: 'open', reservation_status: 'not_reserved' }] },
  { match: /SELECT \* FROM work_order_materials .* FOR UPDATE/, rows: [{ id: 'M1', item_id: ITEM, source_warehouse_id: WAREHOUSE, required_qty: 60, reserved_qty: 0, uom: 'm' }] },
  { match: /INSERT INTO stock_balances/, rows: [] },
  { match: /SELECT on_hand_qty FROM stock_balances/, rows: [{ on_hand_qty: 100 }] },
  { match: /SUM\(rl\.reserved_qty/, rows: [{ qty: 0 }] },
  { match: /INSERT INTO stock_reservations \(/, rows: [{ id: 'R1', work_order_id: WO, status: 'active' }] },
  { match: /INSERT INTO stock_reservation_lines/, rows: [] },
  { match: /UPDATE work_order_materials/, rows: [] },
  { match: /UPDATE work_orders SET reservation_status/, rows: [] },
  { match: /INSERT INTO work_order_events/, rows: [] },
  { match: /SELECT \* FROM stock_reservations WHERE tenant_id/, rows: [{ id: 'R1', work_order_id: WO, status: 'active' }] },
  { match: /SELECT \* FROM stock_reservation_lines WHERE tenant_id/, rows: [{ reservation_id: 'R1', item_id: ITEM, warehouse_id: WAREHOUSE, reserved_qty: 60, consumed_qty: 0, released_qty: 0 }] },
];

describe('reservation service integrity (unit)', () => {
  beforeEach(() => __setCurrentClient(createClient()));
  afterEach(() => __setCurrentClient(null));

  it('rejects a short idempotency key before issuing a single statement', async () => {
    const client = (await import('@/lib/db')).getSql() as unknown as FakeClient;
    await expect(reserveWorkOrderMaterials(ACTOR, WO, 'short')).rejects.toThrow(/idempotency anahtarı/);
    expect(client.recorder.executed).toHaveLength(0);
    expect(client.recorder.unsafeCalls).toHaveLength(0);
  });

  it('binds the idempotency lookup (and the replayed load) to the caller tenant', async () => {
    const client = createClient([
      { match: /SELECT id, work_order_id FROM stock_reservations/, rows: [{ id: 'R1', work_order_id: WO }] },
      { match: /SELECT \* FROM stock_reservations WHERE tenant_id/, rows: [{ id: 'R1', work_order_id: WO, status: 'active' }] },
      { match: /SELECT \* FROM stock_reservation_lines WHERE tenant_id/, rows: [{ reservation_id: 'R1', reserved_qty: 60, consumed_qty: 0, released_qty: 0 }] },
    ]);
    __setCurrentClient(client);

    const reservation = await reserveWorkOrderMaterials(ACTOR, WO, 'unit-idem-key-0001');
    expect(reservation.id).toBe('R1');

    const lookup = client.recorder.calls[0];
    expect(lookup.text).toMatch(/SELECT id, work_order_id FROM stock_reservations/);
    expect(lookup.values[0]).toBe(TENANT);
    expect(lookup.values[1]).toBe('unit-idem-key-0001');
    // Replay is read-only: the same key for another work order fails before any write, and the
    // lookup that produced that failure is still tenant-scoped.
    const replay = createClient([
      { match: /SELECT id, work_order_id FROM stock_reservations/, rows: [{ id: 'R9', work_order_id: 'other-wo' }] },
    ]);
    __setCurrentClient(replay);
    await expect(reserveWorkOrderMaterials(ACTOR, WO, 'unit-idem-key-0002')).rejects.toThrow(/farklı bir rezervasyonda kullanılmış/);
    expect(replay.recorder.calls[0].values[0]).toBe(TENANT);
    expect(replay.recorder.executed.some((s) => s.includes('INSERT'))).toBe(false);
  });

  it('checks each material against the bucket independently and writes only after the loop (over-reservation characterisation)', async () => {
    // Two material rows sharing ONE (item, warehouse): 100 on hand, 60 needed twice. Each check
    // passes alone, so the loop would reserve 120 of 100. The schema's UNIQUE
    // (tenant_id, work_order_id, item_id, source_warehouse_id) makes such rows impossible —
    // test-reservation-integrity.ts proves that constraint against a real database.
    const client = createClient([
      { match: /SELECT id, work_order_id FROM stock_reservations/, rows: [] },
      { match: /FROM work_orders .* FOR UPDATE/, rows: [{ id: WO, order_id: ORDER, status: 'open', reservation_status: 'not_reserved' }] },
      { match: /SELECT \* FROM work_order_materials .* FOR UPDATE/, rows: [
        { id: 'M1', item_id: ITEM, source_warehouse_id: WAREHOUSE, required_qty: 60, reserved_qty: 0, uom: 'm' },
        { id: 'M2', item_id: ITEM, source_warehouse_id: WAREHOUSE, required_qty: 60, reserved_qty: 0, uom: 'm' },
      ] },
      { match: /INSERT INTO stock_balances/, rows: [] },
      { match: /SELECT on_hand_qty FROM stock_balances/, rows: [{ on_hand_qty: 100 }] },
      { match: /SUM\(rl\.reserved_qty/, rows: [{ qty: 0 }] },
      { match: /INSERT INTO stock_reservations \(/, rows: [{ id: 'R1', work_order_id: WO, status: 'active' }] },
      { match: /INSERT INTO stock_reservation_lines/, rows: [] },
      { match: /UPDATE work_order_materials/, rows: [] },
      { match: /UPDATE work_orders SET reservation_status/, rows: [] },
      { match: /INSERT INTO work_order_events/, rows: [] },
      { match: /SELECT \* FROM stock_reservations WHERE tenant_id/, rows: [{ id: 'R1', work_order_id: WO, status: 'active' }] },
      { match: /SELECT \* FROM stock_reservation_lines WHERE tenant_id/, rows: [] },
    ]);
    __setCurrentClient(client);

    await reserveWorkOrderMaterials(ACTOR, WO, 'unit-idem-key-0003');

    const balanceLocks = client.recorder.executed.filter((s) => s.includes('SELECT on_hand_qty FROM stock_balances'));
    const sums = client.recorder.executed.filter((s) => s.includes('SUM(rl.reserved_qty'));
    const lineInserts = client.recorder.calls.filter((c) => c.text.includes('INSERT INTO stock_reservation_lines'));
    expect(balanceLocks).toHaveLength(2);
    expect(sums).toHaveLength(2);
    expect(lineInserts).toHaveLength(2);

    // Every availability read saw the same untouched bucket: no row accumulates the previous row's need.
    const inserted = lineInserts.reduce((total, call) => total + Number(call.values[4]), 0);
    expect(inserted).toBe(120);
    expect(inserted).toBeGreaterThan(100);
    // ...and no statement ran before the whole availability loop finished.
    const firstBalanceLock = client.recorder.executed.findIndex((s) => s.includes('SELECT on_hand_qty FROM stock_balances'));
    const firstLineInsert = client.recorder.executed.findIndex((s) => s.includes('INSERT INTO stock_reservation_lines'));
    expect(firstLineInsert).toBeGreaterThan(firstBalanceLock);
    expect(client.recorder.executed.indexOf(client.recorder.executed.find((s) => s.includes('SUM(rl.reserved_qty'))!)).toBeLessThan(firstLineInsert);
  });

  it('aborts the whole reservation when any single material fails its availability check', async () => {
    const client = createClient([
      { match: /SELECT id, work_order_id FROM stock_reservations/, rows: [] },
      { match: /FROM work_orders .* FOR UPDATE/, rows: [{ id: WO, order_id: ORDER, status: 'open', reservation_status: 'not_reserved' }] },
      { match: /SELECT \* FROM work_order_materials .* FOR UPDATE/, rows: [
        { id: 'M1', item_id: ITEM, source_warehouse_id: WAREHOUSE, required_qty: 10, reserved_qty: 0, uom: 'm' },
        { id: 'M2', item_id: ITEM, source_warehouse_id: WAREHOUSE, required_qty: 60, reserved_qty: 0, uom: 'm' },
      ] },
      { match: /INSERT INTO stock_balances/, rows: [] },
      { match: /SELECT on_hand_qty FROM stock_balances/, rows: [{ on_hand_qty: 100 }] },
      { match: /SUM\(rl\.reserved_qty/, rows: [{ qty: 95 }] },
      { match: /INSERT INTO stock_reservations \(/, rows: [{ id: 'R1', work_order_id: WO, status: 'active' }] },
      { match: /INSERT INTO stock_reservation_lines/, rows: [] },
    ]);
    __setCurrentClient(client);

    // First material: 10 <= 100 - 95 = 5? No — 10 > 5, so the loop throws on row one and the
    // reservation header (handler present but never reached) is never written.
    await expect(reserveWorkOrderMaterials(ACTOR, WO, 'unit-idem-key-0004')).rejects.toThrow(/Yetersiz kullanılabilir stok/);
    expect(client.recorder.executed.some((s) => s.includes('INSERT INTO stock_reservations'))).toBe(false);
    expect(client.recorder.executed.some((s) => s.includes('INSERT INTO stock_reservation_lines'))).toBe(false);
    expect(client.recorder.executed.some((s) => s.includes('UPDATE work_orders'))).toBe(false);
  });

  it('releases with released = reserved - consumed and collapses material reserved to consumed, tenant-scoped throughout', async () => {
    const client = createClient([
      { match: /FROM work_orders .* FOR UPDATE/, rows: [{ id: WO, reservation_status: 'reserved' }] },
      { match: /FROM stock_reservations .* status = 'active'/, rows: [{ id: 'R1' }] },
      { match: /UPDATE stock_reservation_lines/, rows: [] },
      { match: /UPDATE stock_reservations SET status = 'released'/, rows: [] },
      { match: /UPDATE work_order_materials/, rows: [] },
      { match: /UPDATE work_orders SET reservation_status = 'released'/, rows: [] },
    ]);
    __setCurrentClient(client);

    const result = await releaseWorkOrderReservation(ACTOR, WO);
    expect(result).toEqual({ released: true, workOrderId: WO });

    const executed = client.recorder.executed;
    expect(executed.some((s) => s.includes('released_qty = reserved_qty - consumed_qty'))).toBe(true);
    expect(executed.some((s) => s.includes('SET reserved_qty = consumed_qty'))).toBe(true);
    expect(executed.some((s) => s.includes("SET status = 'released'"))).toBe(true);
    expect(executed.some((s) => s.includes("reservation_status = 'released'"))).toBe(true);
    // No line or material is touched outside the caller's tenant.
    for (const call of client.recorder.calls) {
      expect(call.values[0]).toBe(TENANT);
    }
  });

  it('refuses release and reserve for a foreign tenant without issuing a statement about the other tenant\'s rows', async () => {
    const client = createClient([
      { match: /FROM work_orders .* FOR UPDATE/, rows: [] },
    ]);
    __setCurrentClient(client);
    const stranger = { tenantId: '99999999-9999-4000-8000-000000000099', userId: 'user-2', role: 'owner' } as any;

    await expect(releaseWorkOrderReservation(stranger, WO)).rejects.toThrow(/Üretim emri bulunamadı/);
    // The single lookup that ran was scoped to the stranger's tenant, so tenant A's reservation
    // was never selected and therefore never released.
    expect(client.recorder.calls[0].values[0]).toBe(stranger.tenantId);
    // no UPDATE runs for a foreign tenant
    expect(client.recorder.executed.some((s) => s.startsWith('UPDATE '))).toBe(false);

    const reserveClient = createClient([
      { match: /SELECT id, work_order_id FROM stock_reservations/, rows: [] },
      { match: /FROM work_orders .* FOR UPDATE/, rows: [] },
    ]);
    __setCurrentClient(reserveClient);
    await expect(reserveWorkOrderMaterials(stranger, WO, 'unit-idem-key-0005')).rejects.toThrow(/Üretim emri bulunamadı/);
    expect(reserveClient.recorder.calls[0].values[0]).toBe(stranger.tenantId);
    expect(reserveClient.recorder.executed.some((s) => s.includes('INSERT'))).toBe(false);
  });
});
