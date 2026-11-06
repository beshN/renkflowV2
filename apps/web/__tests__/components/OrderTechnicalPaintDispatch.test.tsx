import { render, screen } from "@testing-library/react";
import { OrderTechnicalPanel } from "@/components/features/orders/OrderTechnicalPanel";
import { requestJson } from "@/lib/shared/network";

jest.mock("@/components/features/orders/OrderDrawings", () => ({
  OrderDrawings: () => <div data-testid="order-drawings">Drawing widget</div>,
}));
jest.mock("@/lib/shared/network", () => ({ requestJson: jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
for (const path of [
  "@/components/features/foy/MeasuredFoyView",
  "@/components/features/manufacturing/QualityChecklist",
  "@/components/features/orders/OrderLoadingPanel",
  "@/components/features/manufacturing/WorkshopPanel",
  "@/components/features/foy/FoyWorkbench",
  "@/components/features/awning/AwningConfigurator",
  "@/components/features/product-3d/ProductConfigurator",
  "@/components/drawing/ProductDrawing",
  "@/components/features/foy/FoySchema",
])
  jest.doMock(path, () => new Proxy({}, { get: () => () => null }));

const request = requestJson as jest.Mock;
const workspace = (technical: Record<string, unknown>) => ({
  order: { order_number: "SIP-1", provisional: false, tenant_id: "t" },
  quote: null,
  revisions: [
    {
      id: "rev-1",
      revision: 2,
      status: "draft",
      technical: { drilling: [], ...technical },
      document: { systems: [] },
      plan: { plan: { groups: [] } },
    },
  ],
  jobs: [],
  operations: [],
  family: "makasli",
  canEdit: true,
  canApprove: true,
  legacy: false,
  legacyProducts: [],
  shipments: [],
  parts: [],
  revisionParts: [],
  sharedPlans: [],
  materialDecisions: [],
  cutPlan: null,
  step: 3,
});

test("sevkiyattaki profil teknik panelde eski dönüş düğmesiyle sonuçlandırılamaz", async () => {
  request.mockReset();
  const data = workspace({ blockers: [], warnings: [] });
  const paint = {
    work_order_id: "job",
    item_id: "item",
    item_name: "Profil",
    length_mm: 1000,
    target_color: "RAL 7016",
    total: 2,
    waiting: 1,
    sent: 1,
    returned: 0,
    assembled: 0,
    weight_kg: null,
  };
  request.mockResolvedValue({
    ok: true,
    data: {
      ...data,
      revisions: [{ ...data.revisions[0], status: "approved" }],
      parts: [{ ...paint, in_dispatch: true }],
    },
  });
  render(<OrderTechnicalPanel orderId="order-1" />);
  expect(
    await screen.findByRole("button", { name: "Boyadan geldi" }),
  ).toBeDisabled();
  expect(
    screen.getByText("Boyahane sevkiyatından sonuçlandırın"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Boyaya gönderildi" }),
  ).toBeEnabled();
});
test("sevkiyatsız profilde eski dönüş düğmesi çalışır", async () => {
  request.mockReset();
  const data = workspace({ blockers: [], warnings: [] });
  request.mockResolvedValue({
    ok: true,
    data: {
      ...data,
      revisions: [{ ...data.revisions[0], status: "approved" }],
      parts: [
        {
          work_order_id: "job",
          item_id: "item",
          item_name: "Profil",
          length_mm: 1000,
          target_color: "RAL 7016",
          total: 1,
          waiting: 0,
          sent: 1,
          returned: 0,
          assembled: 0,
          in_dispatch: false,
        },
      ],
    },
  });
  render(<OrderTechnicalPanel orderId="order-1" />);
  expect(
    await screen.findByRole("button", { name: "Boyadan geldi" }),
  ).toBeEnabled();
  expect(
    screen.queryByText("Boyahane sevkiyatından sonuçlandırın"),
  ).not.toBeInTheDocument();
});
