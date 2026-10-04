import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ScanTerminal from "@/components/features/warehouse/ScanTerminal";
const command = jest.fn(),
  fixture = {
    actor: { role: "owner" },
    items: [{ id: "part", sku: "SCR", name: "Screw", stock_uom: "adet" }],
    locations: [
      { id: "a", warehouse_code: "RAW", code: "A" },
      { id: "b", warehouse_code: "RAW", code: "B" },
    ],
    lots: [],
    balances: [{ item_id: "part", location_id: "a", quantity: 10, version: 4 }],
  };
jest.mock("@/components/features/warehouse/useWarehouse", () => ({
  useWarehouse: () => ({
    data: fixture,
    error: "",
    busy: false,
    online: true,
    refresh: jest.fn(),
    command,
  }),
}));
jest.mock("@/lib/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "owner", tenantId: "tenant", role: "owner" } }),
}));
jest.mock("@/components/features/warehouse/BarcodeScanner", () => ({
  __esModule: true,
  default: () => null,
}));
it("whole-unit transfer passes native browser step validation and sends the shelf version", async () => {
  command.mockResolvedValue({ entryNumber: "STK-TEST" });
  render(<ScanTerminal />);
  fireEvent.click(screen.getByRole("button", { name: "Raf transferi" }));
  fireEvent.change(screen.getByLabelText("Malzeme"), {
    target: { value: "part" },
  });
  fireEvent.change(screen.getByLabelText("Kaynak raf"), {
    target: { value: "a" },
  });
  fireEvent.change(screen.getByLabelText("Hedef raf"), {
    target: { value: "b" },
  });
  const amount = screen.getByLabelText(/Taşınacak miktar/) as HTMLInputElement;
  fireEvent.change(amount, { target: { value: "5" } });
  expect(amount.checkValidity()).toBe(true);
  fireEvent.change(amount, { target: { value: "1.5" } });
  expect(amount.checkValidity()).toBe(false);
  fireEvent.change(amount, { target: { value: "5" } });
  fireEvent.submit(amount.closest("form")!);
  await waitFor(() =>
    expect(command).toHaveBeenCalledWith(
      "transfer",
      expect.objectContaining({
        quantity: 5,
        version: 4,
        sourceId: "a",
        targetId: "b",
      }),
    ),
  );
});
