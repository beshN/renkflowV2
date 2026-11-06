import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LotTracePanel } from "@/components/features/manufacturing/LotTracePanel";
import { requestJson } from "@/lib/shared/network";
import { useMemberAccess } from "@/lib/hooks/useMemberAccess";

jest.mock("@/lib/shared/network", () => ({ requestJson: jest.fn() }));
jest.mock("@/lib/hooks/useMemberAccess", () => ({ useMemberAccess: jest.fn() }));
const request = requestJson as jest.Mock;
const access = useMemberAccess as jest.Mock;
const ok = (lots: unknown[] = []) => ({ ok: true, status: 200, data: { data: { lots } } });
const lot = {
  id: "lot", lot_number: "LOT-1", product_code: "P-108", product_name: "Alüminyum profil",
  warehouse_name: "Ana depo", created_at: "2026-05-01T12:00:00Z",
  remaining_qty: "12.50", uom: "m", parentLotId: null, workOrders: [],
};
beforeEach(() => {
  request.mockReset().mockResolvedValue(ok());
  access.mockReturnValue({
    roleKey: "office", roleName: "Ofis", base: "office", hidden: [],
    permissions: { inventory: ["view"], production: ["view"] },
  });
});
function search(value = "HEAT-1") {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
  fireEvent.submit(screen.getByRole("button", { name: "Ara" }).closest("form")!);
}

test("ilk açılışta ve boş aramada istek göndermez", () => {
  render(<LotTracePanel />);
  search("   ");
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Ara" })).toBeDisabled();
  expect(screen.queryByText("Bu numarayla kayıtlı lot yok")).not.toBeInTheDocument();
});

test.each([
  ["heat", " H & 1 "],
  ["supplierLot", " LOT/42 "],
])("%s için yalnız doğru parametreyle tam numarayı gönderir", async (type, value) => {
  render(<LotTracePanel />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: type } });
  search(value);
  await screen.findByText("Bu numarayla kayıtlı lot yok");
  const [url, init] = request.mock.calls[0];
  const params = new URL(url, "http://localhost").searchParams;
  expect([...params.entries()]).toEqual([[type, value.trim()]]);
  expect(init.cache).toBe("no-store");
  expect(init.method).toBeUndefined();
});

test("lot bilgileri, ana lot, kaynak etiketleri, sipariş linki ve birimler ayrı gösterilir; toplam yok", async () => {
  const work = { id: "work", title: "İş emri 1", order: { id: "order-1", order_number: "SIP-1" } };
  request.mockResolvedValue(ok([
    { ...lot, workOrders: [
      { ...work, cutPlanId: "cut", allocationId: null, quantity: "2.75", uom: "m" },
      { ...work, cutPlanId: null, allocationId: "allocation", quantity: "4.25", uom: "kg" },
      { ...work, cutPlanId: null, allocationId: "allocation-2", quantity: "3", uom: "adet" },
    ] },
    { ...lot, id: "remnant", lot_number: "ARTIK-1", parentLotId: "lot", remaining_qty: "1.25", uom: "kg" },
    { ...lot, id: "piece", lot_number: "LOT-3", remaining_qty: "7", uom: "adet" },
  ]));
  render(<LotTracePanel />);
  search();
  await screen.findByText("Lot LOT-1");
  expect(screen.getAllByText("Profil: P-108 · Alüminyum profil")).toHaveLength(3);
  expect(screen.getAllByText(/Ana depo · Giriş tarihi: 01.05.2026/)).toHaveLength(3);
  expect(screen.getByText("Kalan miktar: 12.50 m")).toBeInTheDocument();
  expect(screen.getByText("Kalan miktar: 1.25 kg")).toBeInTheDocument();
  expect(screen.getByText("Kalan miktar: 7 adet")).toBeInTheDocument();
  expect(screen.getByText("Ana lot no: LOT-1")).toBeInTheDocument();
  expect(screen.getByText("Kesim planı · 2.75 m")).toBeInTheDocument();
  expect(screen.getByText("Malzeme kaydı · 4.25 kg")).toBeInTheDocument();
  expect(screen.getByText("Malzeme kaydı · 3 adet")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "SIP-1" })[0]).toHaveAttribute("href", "/orders/order-1");
  expect(screen.queryByText(/toplam/i)).not.toBeInTheDocument();
});

test("yükleniyor, boş sonuç ve hata ayrıdır; tekrar dene son aramayı kullanır", async () => {
  let finish!: (value: unknown) => void;
  request.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  render(<LotTracePanel />);
  search();
  expect(screen.getByRole("status")).toHaveTextContent("Yükleniyor");
  await act(async () => { finish({ ok: false, status: 500 }); });
  expect(screen.getByRole("alert")).toHaveTextContent("Yüklenemedi");
  expect(screen.queryByText("Bu numarayla kayıtlı lot yok")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "başka" } });
  expect(screen.getByRole("button", { name: "Tekrar dene" })).toHaveAttribute("type", "button");
  fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
  await screen.findByText("Bu numarayla kayıtlı lot yok");
  expect(request.mock.calls[1][0]).toBe(request.mock.calls[0][0]);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("404 erişim yok sayılır ve bölüm gizlenir", async () => {
  request.mockResolvedValue({ ok: false, status: 404 });
  render(<LotTracePanel />);
  search();
  await waitFor(() => expect(screen.queryByRole("region", { name: "Lot izleme" })).not.toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test.each(["worker", "accountant", "member"])("%s rolü ve usta göremez", (base) => {
  access.mockReturnValue({ base, permissions: { inventory: ["view"], production: ["view"] } });
  const { container } = render(<LotTracePanel />);
  expect(container).toBeEmptyDOMElement();
  expect(request).not.toHaveBeenCalled();
});

test.each(["inventory", "production"])("%s:view eksikken gizlidir", (module) => {
  const permissions = { inventory: ["view"], production: ["view"], [module]: [] };
  access.mockReturnValue({ base: "office", permissions });
  const { container } = render(<LotTracePanel />);
  expect(container).toBeEmptyDOMElement();
  expect(request).not.toHaveBeenCalled();
});

test.each(["owner", "admin", "office"])("%s gerekli izinlerle görebilir", (base) => {
  access.mockReturnValue({ base, permissions: { inventory: ["view"], production: ["view"] } });
  render(<LotTracePanel />);
  expect(screen.getByRole("region", { name: "Lot izleme" })).toBeInTheDocument();
});

test("erişim bilinmiyorsa gizlidir", () => {
  access.mockReturnValue(null);
  const { container } = render(<LotTracePanel />);
  expect(container).toBeEmptyDOMElement();
});

test("yeni arama eski isteği iptal eder; geç gelen yanıtı göstermez", async () => {
  let finish!: (value: unknown) => void;
  request.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  render(<LotTracePanel />);
  search("eski");
  search("yeni");
  await screen.findByText("Bu numarayla kayıtlı lot yok");
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => { finish(ok([lot])); });
  expect(screen.queryByText("Lot LOT-1")).not.toBeInTheDocument();
});

test.each([
  ["HEAT-42", "SUP-21"],
  [null, null],
  [undefined, undefined],
  ["HEAT-42", null],
  [null, "SUP-21"],
])("lot kartındaki numaralar yalnız varsa gösterilir: %s / %s", async (heat, supplierLot) => {
  request.mockResolvedValue(ok([{ ...lot, heat_number: heat, supplier_lot_number: supplierLot }]));
  render(<LotTracePanel />); search();
  await screen.findByText("Lot LOT-1");
  expect(Boolean(screen.queryByText(/^Döküm no:/))).toBe(Boolean(heat));
  expect(Boolean(screen.queryByText(/^Tedarikçi lot no:/))).toBe(Boolean(supplierLot));
  if (heat) expect(screen.getByText(`Döküm no: ${heat}`)).toBeInTheDocument();
  if (supplierLot) expect(screen.getByText(`Tedarikçi lot no: ${supplierLot}`)).toBeInTheDocument();
});
