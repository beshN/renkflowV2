import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BarcodeScanner from "@/components/features/warehouse/BarcodeScanner";
describe("Factory terminal scanner", () => {
  it("submits handheld scanner Enter input once and clears it without stock mutations", () => {
    const onScan = jest.fn();
    render(<BarcodeScanner onScan={onScan} />);
    const input = screen.getByLabelText("Etiket veya barkod kodu");
    fireEvent.change(input, { target: { value: "RF-L-ABCDEF012345" } });
    fireEvent.submit(input.closest("form")!);
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("RF-L-ABCDEF012345");
    expect(input).toHaveValue("");
  });
  it("does not submit while a previous lookup is in progress", () => {
    const onScan = jest.fn();
    render(<BarcodeScanner onScan={onScan} busy />);
    expect(screen.getByRole("button", { name: "Okunuyor…" })).toBeDisabled();
    fireEvent.submit(
      screen.getByLabelText("Etiket veya barkod kodu").closest("form")!,
    );
    expect(onScan).not.toHaveBeenCalled();
  });
  it("offers manual/handheld fallback when a camera cannot be used", async () => {
    render(<BarcodeScanner onScan={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Kamerayla okut" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("HTTPS"),
    );
    expect(screen.getByLabelText("Etiket veya barkod kodu")).toBeEnabled();
  });
});
