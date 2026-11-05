import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrderDrawings } from "@/components/features/orders/OrderDrawings";
import { requestJson } from "@/lib/shared/network";
jest.mock("@/lib/shared/network", () => ({ requestJson: jest.fn() }));
test("missing measures remain visible on the printable sheet without a fabricated SVG", async () => {
  (requestJson as jest.Mock).mockResolvedValue({
    ok: true,
    data: {
      orderNumber: "TEST-SYNTHETIC",
      lines: [
        {
          id: "synthetic",
          productName: "Makaslı tente",
          svg: null,
          message: "ölçü eksik: genişlik",
        },
      ],
    },
  });
  const print = jest.spyOn(window, "print").mockImplementation(() => {});
  const { container } = render(<OrderDrawings orderId="test" printable />);
  expect(await screen.findByText("ölçü eksik: genişlik")).toBeInTheDocument();
  expect(container.querySelector("svg")).toBeNull();
  fireEvent.click(screen.getByText("Yazdır / PDF olarak kaydet"));
  expect(print).toHaveBeenCalledTimes(1);
  print.mockRestore();
});
test("failed or denied request offers no PDF action or stale drawing", async () => {
  (requestJson as jest.Mock).mockResolvedValue({
    ok: false,
    error: "Sipariş bulunamadı",
  });
  render(<OrderDrawings orderId="foreign" printable />);
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Sipariş bulunamadı"),
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("empty panel is hidden while the print view explains the empty state", async () => {
  (requestJson as jest.Mock).mockResolvedValue({
    ok: true,
    data: { orderNumber: "TEST", lines: [] },
  });
  const { container, unmount } = render(<OrderDrawings orderId="empty" />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
  unmount();
  render(<OrderDrawings orderId="empty" printable />);
  expect(
    await screen.findByText("Makaslı tente kalemi yok."),
  ).toBeInTheDocument();
});
