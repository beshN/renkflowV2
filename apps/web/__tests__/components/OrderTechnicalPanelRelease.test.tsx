import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OrderTechnicalPanel } from '@/components/features/orders/OrderTechnicalPanel';
import { requestJson } from '@/lib/shared/network';
import { technicalIssues, TECHNICAL_WARNINGS } from '@/lib/features/orders/technical';

jest.mock('@/components/features/orders/OrderDrawings', () => ({ OrderDrawings: () => <div data-testid="order-drawings">Drawing widget</div> }));
jest.mock('@/lib/shared/network', () => ({ requestJson: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
for (const path of [
  '@/components/features/foy/MeasuredFoyView',
  '@/components/features/manufacturing/QualityChecklist',
  '@/components/features/orders/OrderLoadingPanel',
  '@/components/features/manufacturing/WorkshopPanel',
  '@/components/features/foy/FoyWorkbench',
  '@/components/features/awning/AwningConfigurator',
  '@/components/features/product-3d/ProductConfigurator',
  '@/components/drawing/ProductDrawing',
  '@/components/features/foy/FoySchema',
])
  jest.doMock(path, () => new Proxy({}, { get: () => () => null }));

const request = requestJson as jest.Mock;
const workspace = (technical: Record<string, unknown>) => ({
  order: { order_number: 'SIP-1', provisional: false, tenant_id: 't' },
  quote: null,
  revisions: [{ id: 'rev-1', revision: 2, status: 'draft', technical: { drilling: [], ...technical }, document: { systems: [] }, plan: { plan: { groups: [] } } }],
  jobs: [], operations: [], family: 'makasli', canEdit: true, canApprove: true, legacy: false, legacyProducts: [],
  shipments: [], parts: [], revisionParts: [], sharedPlans: [], materialDecisions: [], cutPlan: null, step: 3,
});

describe('technical plan release', () => {
  beforeEach(() => request.mockReset());

  it('sorts notes saved before the split: stock and recipe notes are warnings, the rest still blocks', () => {
    expect(
      technicalIssues({
        blockers: ['Kesim için uygun stok tamamlanmalı', 'Atölyenin testere ve uç düzeltme değerleri doğrulanmalı', 'Genişlik, açılım ve bölme bilgileri doğrulanmalı'],
      }),
    ).toEqual({
      blockers: ['Genişlik, açılım ve bölme bilgileri doğrulanmalı'],
      warnings: ['Kesim için uygun stok tamamlanmalı', 'Atölyenin testere ve uç düzeltme değerleri doğrulanmalı'],
    });
  });

  it('opens production once the person ticks that they saw the warnings', async () => {
    request.mockResolvedValueOnce({ ok: true, data: workspace({ blockers: [], warnings: [TECHNICAL_WARNINGS.stock, TECHNICAL_WARNINGS.recipe] }) });
    render(<OrderTechnicalPanel orderId="order-1" />);
    const approve = await screen.findByRole('button', { name: 'Planı onayla ve üretime aç' });
    expect(screen.getByText(TECHNICAL_WARNINGS.stock)).toBeInTheDocument();
    expect(approve).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /Uyarıları gördüm/ }));
    expect(approve).toBeEnabled();
    request.mockResolvedValueOnce({ ok: true, data: { waitingForStock: true } }).mockResolvedValue({ ok: true, data: workspace({ blockers: [], warnings: [] }) });
    fireEvent.click(approve);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({ action: 'approve', revisionId: 'rev-1', acknowledgeWarnings: true });
  });

  it('keeps a genuine blocker in front of the button, with no way to tick past it', async () => {
    request.mockResolvedValueOnce({ ok: true, data: workspace({ blockers: ['Föyde okunamayan kesim ölçüleri var; föyü düzeltip yeniden yükleyin'], warnings: [TECHNICAL_WARNINGS.stock] }) });
    render(<OrderTechnicalPanel orderId="order-1" />);
    expect(await screen.findByRole('button', { name: 'Planı onayla ve üretime aç' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Üretime açmadan önce düzeltilmeli');
    expect(screen.queryByRole('checkbox', { name: /Uyarıları gördüm/ })).not.toBeInTheDocument();
  });
});

test('worker panel never mounts the drawing widget or its forbidden request', async () => {
  request.mockReset();
  request.mockResolvedValue({ ok: true, data: workspace({ blockers: [], warnings: [] }) });
  render(<OrderTechnicalPanel orderId="order-1" worker />);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(screen.queryByTestId('order-drawings')).not.toBeInTheDocument();
  expect(request.mock.calls.every(([url]) => !url.endsWith('/drawing'))).toBe(true);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('office panel retains the drawing widget', async () => {
  request.mockReset();
  request.mockResolvedValue({ ok: true, data: workspace({ blockers: [], warnings: [] }) });
  render(<OrderTechnicalPanel orderId="order-1" />);
  expect(await screen.findByTestId('order-drawings')).toBeInTheDocument();
});
