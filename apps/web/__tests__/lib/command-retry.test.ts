/** @jest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { useCommandRetry } from "@/lib/hooks/useCommandRetry";
import { requestJson } from "@/lib/shared/network";
jest.mock("@/lib/shared/network", () => ({ requestJson: jest.fn() }));
const request = jest.mocked(requestJson);
describe("quantity command retry", () => {
  beforeEach(() => request.mockReset());
  it("allows a bounded research timeout without changing command identity rules", async () => {
    request.mockResolvedValue({ ok: true, status: 200, data: {}, error: null });
    const { result } = renderHook(() => useCommandRetry());
    await act(async () => {
      await result.current(
        "/leads/company",
        { action: "researchCompany" },
        "root",
        { timeoutMs: 100000 },
      );
    });
    expect(request.mock.calls[0][2]).toEqual({ timeoutMs: 100000 });
  });
  it("retries a lost reply with the same identity and refuses changing an unresolved quantity", async () => {
    request
      .mockResolvedValueOnce({
        ok: false,
        status: 0,
        error: "timeout",
        data: null,
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        error: null,
        data: { quantity: 1 },
      });
    const { result } = renderHook(() => useCommandRetry());
    await act(async () => {
      await result.current("/parts", {
        commandId: "discard-1",
        action: "paint.send",
        quantity: 1,
      });
    });
    await act(async () => {
      const r = await result.current("/parts", {
        action: "paint.send",
        quantity: 2,
      });
      expect(r.ok).toBe(false);
    });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current("/parts", {
        commandId: "discard-2",
        quantity: 1,
        action: "paint.send",
      });
    });
    const first = JSON.parse(request.mock.calls[0][1]!.body as string),
      retry = JSON.parse(request.mock.calls[1][1]!.body as string);
    expect(retry.commandId).toBe(first.commandId);
    await act(async () => {
      await result.current("/parts", { action: "paint.send", quantity: 2 });
    });
    expect(
      JSON.parse(request.mock.calls[2][1]!.body as string).commandId,
    ).not.toBe(first.commandId);
  });
});
