import { act, fireEvent, render, screen } from "@testing-library/react";
import { StationWorkspace } from "@/components/features/stations/StationWorkspace";

jest.mock("@/components/drawing/ProductDrawing", () => ({
  ProductDrawing: () => null,
}));
jest.mock("@/components/drawing/CutDiagram", () => ({
  CutDiagram: () => null,
}));
jest.mock("@/components/features/pdf-viewer/LazyPDFViewer", () => ({
  __esModule: true,
  default: () => null,
}));
const overview = (name: string) => ({
  device: {
    name,
    kind: "assembly",
    label: "Montaj",
    workCenterCode: "ASSEMBLY",
  },
  operations: [],
  files: [],
  instructions: [],
  cutPlans: [],
  balances: [],
  moves: [],
});
const ok = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({ data }),
  } as Response);

beforeEach(() => {
  jest.useFakeTimers();
  window.history.replaceState(null, "", "/station");
});
afterEach(() => {
  jest.useRealTimers();
});

it("prioritizes a new pairing link over the existing device cookie and loads the new assignment after acceptance", async () => {
  window.history.replaceState(null, "", "/station#pair=" + "a".repeat(32));
  global.fetch = jest.fn((url: string) =>
    url.endsWith("/pair")
      ? ok({ ok: true })
      : ok(overview("Yeni montaj tableti")),
  ) as unknown as typeof fetch;
  render(<StationWorkspace />);
  await act(async () => {
    jest.advanceTimersByTime(15000);
  });
  expect(
    screen.getByRole("heading", { name: "Tableti istasyona bağlayın" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Tek kullanımlık eşleştirme kodu")).toHaveValue(
    "a".repeat(32),
  );
  expect(global.fetch).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Tableti bağla" }));
  await act(async () => {});
  expect(
    screen.getByRole("heading", { name: "Yeni montaj tableti" }),
  ).toBeInTheDocument();
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
    "/api/station/pair",
  );
});

it("switches an already open station into pairing without letting a late old-device response restore its jobs", async () => {
  let resolveOld!: (value: Response) => void;
  global.fetch = jest.fn(
    () =>
      new Promise<Response>((resolve) => {
        resolveOld = resolve;
      }),
  ) as unknown as typeof fetch;
  render(<StationWorkspace />);
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  act(() => {
    window.history.replaceState(null, "", "/station#pair=" + "b".repeat(32));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  await act(async () => {
    resolveOld(await ok(overview("Eski istasyon")));
  });
  expect(
    screen.queryByRole("heading", { name: "Eski istasyon" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Tableti istasyona bağlayın" }),
  ).toBeInTheDocument();
});

it("ignores a response from the previous device even after the replacement device has paired successfully", async () => {
  let resolveOld!: (value: Response) => void;
  global.fetch = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockImplementationOnce(() => ok({ ok: true }))
    .mockImplementation(() =>
      ok(overview("Yeni paketleme tableti")),
    ) as unknown as typeof fetch;
  render(<StationWorkspace />);
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  act(() => {
    window.history.replaceState(null, "", "/station#pair=" + "c".repeat(32));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  fireEvent.click(screen.getByRole("button", { name: "Tableti bağla" }));
  await act(async () => {});
  expect(
    screen.getByRole("heading", { name: "Yeni paketleme tableti" }),
  ).toBeInTheDocument();
  await act(async () => {
    resolveOld(await ok(overview("Eski istasyon")));
  });
  expect(
    screen.queryByRole("heading", { name: "Eski istasyon" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Yeni paketleme tableti" }),
  ).toBeInTheDocument();
});
