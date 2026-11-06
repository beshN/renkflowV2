import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PaintDispatchPanel } from "@/components/features/manufacturing/PaintDispatchPanel";
import { requestJson } from "@/lib/shared/network";
import { useMemberAccess } from "@/lib/hooks/useMemberAccess";

jest.mock("@/lib/shared/network", () => ({ requestJson: jest.fn() }));
jest.mock("@/lib/hooks/useMemberAccess", () => ({
  useMemberAccess: jest.fn(),
}));
const request = requestJson as jest.Mock;
const access = useMemberAccess as jest.Mock;
const root = "/api/v1/production/paint-dispatches";
const part = (id: string) => ({
  id,
  work_order_id: "job",
  work_order_title: "İş emri 1",
  order_number: "SIP-1",
  profile_code: "P1",
  profile_name: "Profil " + id,
  length_mm: 1000,
  weight_kg: null,
});
const candidates = {
  groups: [
    { target_color: "RAL 7016", parts: [part("a"), part("b")] },
    { target_color: "RAL 9005", parts: [part("c")] },
  ],
  suppliers: [{ id: "supplier", name: "Boyahane A" }],
};
const dispatch = {
  id: "dispatch",
  dispatch_number: "1",
  supplier_name: "Boyahane A",
  target_color: "RAL 7016",
  sent_at: "2026-01-01",
  expected_return_date: null,
  overdue: false,
  sent_count: 2,
  pending_count: 2,
  returned_count: 0,
  rejected_count: 0,
  weight_kg: null,
  note: null,
};
const ok = (data: unknown) => ({ ok: true, data: { data } });
function setup(list: unknown = []) {
  request.mockImplementation((url: string) =>
    Promise.resolve(
      ok(
        url === root
          ? list
          : url.endsWith("/candidates")
            ? candidates
            : {
                ...dispatch,
                parts: [
                  { ...part("a"), outcome: "sent" },
                  { ...part("b"), outcome: "sent" },
                ],
              },
      ),
    ),
  );
}
const posts = () =>
  request.mock.calls.filter(([, init]) => init?.method === "POST");
beforeEach(() => {
  request.mockReset();
  access.mockReturnValue({
    base: "office",
    permissions: { production: ["view", "edit"] },
  });
  setup();
});
async function createForm() {
  render(<PaintDispatchPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Yeni sevkiyat" }));
  await screen.findByRole("combobox", { name: "Renk grubu" });
}

test("renk gruplarını gösterir; renk değişince eski seçim gönderilemez", async () => {
  await createForm();
  const colors = screen.getByRole("combobox", { name: "Renk grubu" });
  expect(
    screen.getByRole("option", { name: "RAL 7016 · 2 adet" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: "RAL 9005 · 1 adet" }),
  ).toBeInTheDocument();
  fireEvent.change(colors, { target: { value: "RAL 7016" } });
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
  fireEvent.change(colors, { target: { value: "RAL 9005" } });
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: "Sevkiyatı oluştur" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByRole("combobox", { name: "Boyahane" }), {
    target: { value: "supplier" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sevkiyatı oluştur" }));
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(JSON.parse(posts()[0][1].body)).toMatchObject({
    action: "paint.dispatch.create",
    data: { partIds: ["c"], supplierId: "supplier" },
    commandId: expect.any(String),
  });
});

test("gerekçesiz Hatalı gönderilmez; kısmi dönüş ve çift tıklama kilidi", async () => {
  setup([dispatch]);
  render(<PaintDispatchPanel />);
  fireEvent.click(await screen.findByRole("button", { name: /Sevkiyat 1/ }));
  fireEvent.change(
    await screen.findByRole("combobox", { name: "Profil a a dönüş sonucu" }),
    { target: { value: "rejected" } },
  );
  const save = screen.getByRole("button", { name: "Seçilen dönüşleri kaydet" });
  expect(save).toBeDisabled();
  fireEvent.click(save);
  expect(posts()).toHaveLength(0);
  fireEvent.change(screen.getByRole("textbox", { name: "Hata gerekçesi" }), {
    target: { value: "  " },
  });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Hata gerekçesi" }), {
    target: { value: "Renk hatalı" },
  });
  let finish!: (value: unknown) => void;
  request.mockImplementation((url, init) =>
    init?.method === "POST"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(
          ok(url === root ? [dispatch] : { ...dispatch, parts: [] }),
        ),
  );
  fireEvent.click(save);
  fireEvent.click(save);
  expect(save).toBeDisabled();
  expect(posts()).toHaveLength(1);
  expect(JSON.parse(posts()[0][1].body).data).toEqual({
    dispatchId: "dispatch",
    parts: [{ partId: "a", outcome: "rejected", rejectReason: "Renk hatalı" }],
  });
  await act(async () => finish(ok({})));
});

test("oluşturma çift gönderilmez ve API hata metni korunur", async () => {
  await createForm();
  fireEvent.change(screen.getByRole("combobox", { name: "Renk grubu" }), {
    target: { value: "RAL 7016" },
  });
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
  fireEvent.change(screen.getByRole("combobox", { name: "Boyahane" }), {
    target: { value: "supplier" },
  });
  let finish!: (value: unknown) => void;
  request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const save = screen.getByRole("button", { name: "Sevkiyatı oluştur" });
  fireEvent.click(save);
  fireEvent.click(save);
  expect(posts()).toHaveLength(1);
  expect(save).toBeDisabled();
  await act(async () => finish({ ok: false, error: "Teknik sürüm değişti" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Teknik sürüm değişti");
  expect(save).toBeEnabled();
  setup();
  fireEvent.click(save);
  await waitFor(() => expect(posts()).toHaveLength(2));
  expect(JSON.parse(posts()[0][1].body).commandId).not.toBe(
    JSON.parse(posts()[1][1].body).commandId,
  );
});

test.each(["list", "candidates", "detail"])(
  "%s yükleme hatası boş liste olmaz; tekrar denenir",
  async (kind) => {
    setup(kind === "detail" ? [dispatch] : []);
    const original = request.getMockImplementation()!;
    let fail = true;
    request.mockImplementation((url, init) =>
      (kind === "list"
        ? url === root
        : kind === "candidates"
          ? url.endsWith("/candidates")
          : url.endsWith("/dispatch")) && fail
        ? Promise.resolve({ ok: false, error: "Bağlantı kesildi" })
        : original(url, init),
    );
    render(<PaintDispatchPanel />);
    if (kind === "candidates")
      fireEvent.click(screen.getByRole("button", { name: "Yeni sevkiyat" }));
    if (kind === "detail")
      fireEvent.click(
        await screen.findByRole("button", { name: /Sevkiyat 1/ }),
      );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bağlantı kesildi",
    );
    if (kind === "list")
      expect(
        screen.queryByText("Henüz açık sevkiyat yok."),
      ).not.toBeInTheDocument();
    if (kind === "candidates")
      expect(
        screen.queryByText("Sevkiyata uygun profil yok."),
      ).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  },
);

test.each([
  null,
  { base: "worker", permissions: { production: ["view", "edit"] } },
  { base: "office", permissions: {} },
])("usta ve erişimsiz bölüm görmez", (value) => {
  access.mockReturnValue(value);
  render(<PaintDispatchPanel />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});
test("salt okunur kullanıcı sevkiyatı görür, işlem düğmeleri görmez", async () => {
  access.mockReturnValue({
    base: "office",
    permissions: { production: ["view"] },
  });
  setup([dispatch]);
  render(<PaintDispatchPanel />);
  fireEvent.click(await screen.findByRole("button", { name: /Sevkiyat 1/ }));
  await screen.findAllByText("Dönüş bekliyor");
  expect(
    screen.queryByRole("button", { name: "Yeni sevkiyat" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Seçilen dönüşleri kaydet" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
test("Gecikmiş etiketi yalnız API true döndürdüğünde görünür", async () => {
  setup([
    { ...dispatch, overdue: true },
    { ...dispatch, id: "other", dispatch_number: "2", overdue: false },
  ]);
  render(<PaintDispatchPanel />);
  expect(await screen.findAllByText("Gecikmiş")).toHaveLength(1);
});

test("yalnız seçilen profil Döndü olarak gönderilir", async () => {
  setup([dispatch]);
  render(<PaintDispatchPanel />);
  fireEvent.click(await screen.findByRole("button", { name: /Sevkiyat 1/ }));
  fireEvent.change(
    await screen.findByRole("combobox", { name: "Profil b b dönüş sonucu" }),
    { target: { value: "returned" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Seçilen dönüşleri kaydet" }),
  );
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(JSON.parse(posts()[0][1].body)).toMatchObject({
    action: "paint.dispatch.return",
    data: {
      dispatchId: "dispatch",
      parts: [{ partId: "b", outcome: "returned" }],
    },
  });
});
