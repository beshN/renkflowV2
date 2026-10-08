import { LIFECYCLE, dropPath, dropTarget, lifecycleIndex, orderHealth } from '@/lib/features/orders/lifecycle';
import { cutView } from '@/lib/features/manufacturing/cut-view';

describe('order lifecycle', () => {
  it('puts every manual status in one of six steps; on hold and cancelled stay apart', () => {
    expect(LIFECYCLE.map((s) => s.label)).toEqual(['Teklif', 'Onay', 'Üretim', 'Kesim', 'Montaj', 'Teslim']);
    expect(lifecycleIndex('new')).toBe(0);
    expect(lifecycleIndex('pending')).toBe(0); // legacy alias
    expect(lifecycleIndex('approved')).toBe(1);
    expect(lifecycleIndex('in_production')).toBe(3);
    expect(lifecycleIndex('ready_for_shipment')).toBe(4);
    expect(lifecycleIndex('delivered')).toBe(5);
    expect(lifecycleIndex('on_hold')).toBe(-1);
    expect(lifecycleIndex('cancelled')).toBe(-1);
  });

  it('accepts a drop only when the transition rules allow one move there', () => {
    expect(dropTarget('new', 'approval')).toBe('pending_approval');
    expect(dropTarget('approved', 'production')).toBe('preparing_materials');
    expect(dropTarget('in_production', 'assembly')).toBe('quality_check');
    expect(dropTarget('new', 'delivery')).toBeNull(); // no jump over steps
    expect(dropTarget('completed', 'quote')).toBeNull(); // no way back
    expect(dropTarget('approved', 'approval')).toBeNull(); // same step, nothing to do
    // Within three allowed moves, never through hold or cancel.
    expect(dropPath('pending_approval', 'production')).toEqual(['approved', 'preparing_materials']);
    expect(dropPath('new', 'production')).toEqual(['approved', 'preparing_materials']);
    expect(dropPath('new', 'cutting')).toBeNull();
  });

  it('scores order health from time used against steps done', () => {
    const today = '2026-10-10';
    expect(orderHealth({ status: 'in_production', deliveryDate: '2026-10-05', createdAt: '2026-09-20' }, today).level).toBe('late');
    expect(orderHealth({ status: 'new', deliveryDate: '2026-10-11', createdAt: '2026-09-20' }, today).level).toBe('risk');
    expect(orderHealth({ status: 'ready_for_shipment', deliveryDate: '2026-10-20', createdAt: '2026-10-01' }, today).level).toBe('good');
    expect(orderHealth({ status: 'approved', deliveryDate: null }, today).level).toBe('watch');
    expect(orderHealth({ status: 'completed', deliveryDate: '2026-10-01' }, today).level).toBe('done');
    expect(orderHealth({ status: 'shipped', deliveryDate: '2026-10-09', createdAt: '2026-09-01' }, today).level).not.toBe('late');
  });
});

describe('cut view for the shop floor', () => {
  it('keeps bars, lengths, colours and pieces, and drops costs and anything unknown', () => {
    const view = cutView({ id: 'p', status: 'approved', result: {
      wastePercent: 4.2, unitCostTotal: 999,
      bars: [{ source: { id: 'l1', itemId: 'i1', color: '7016 MAT', lengthMm: 6000, unitCost: 123.45, isRemnant: false, supplier: 'x' }, pieces: [{ lengthMm: 2000, workOrderId: 'w1', price: 5 }], remainingMm: 3990, reusable: true, lossMm: 10 }],
    } });
    expect(view).toEqual({ id: 'p', status: 'approved', wastePercent: 4.2, bars: [{ id: 'l1', itemId: 'i1', color: '7016 MAT', lengthMm: 6000, isRemnant: false, pieces: [{ lengthMm: 2000, workOrderId: 'w1' }], remainingMm: 3990, reusable: true, lossMm: 10 }] });
    expect(JSON.stringify(view)).not.toMatch(/cost|price|supplier/i);
  });
});
