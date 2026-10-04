import {
  OrderFiltersSchema,
  ViewCommandSchema,
  readOrderFilters,
  orderFiltersQuery,
  sameOrderFilters,
} from "@/lib/features/orders/saved-views";
const uuid = "11111111-1111-4111-8111-111111111111";
it("normalizes legacy statuses and rejects unknown URL filters independently", () => {
  expect(
    readOrderFilters(
      new URLSearchParams(
        "status=delivered&view=unknown&sort=oldest&stage=unknown",
      ),
    ),
  ).toEqual({
    q: "",
    status: "completed",
    view: "all",
    sort: "oldest",
    stage: "",
  });
});
it("round trips Turkish names and a combined saved view through shareable filters", () => {
  const filters = OrderFiltersSchema.parse({
    q: "İstanbul & tente",
    status: "in_production",
    stage: "production",
    view: "overdue",
    sort: "delivery",
  });
  expect(
    readOrderFilters(new URLSearchParams(orderFiltersQuery(filters))),
  ).toEqual(filters);
  expect(orderFiltersQuery(OrderFiltersSchema.parse({}))).toBe("");
  expect(sameOrderFilters(filters, { ...filters })).toBe(true);
  expect(sameOrderFilters(filters, { ...filters, sort: "oldest" })).toBe(false);
});
it("rejects actor overrides, invalid filter names and unversioned edits", () => {
  expect(
    ViewCommandSchema.safeParse({
      commandId: uuid,
      action: "create",
      name: "Work",
      filters: {},
      userId: uuid,
    }).success,
  ).toBe(false);
  expect(
    ViewCommandSchema.safeParse({
      commandId: uuid,
      action: "create",
      name: "Work",
      filters: { totalAmount: 99 },
    }).success,
  ).toBe(false);
  expect(
    ViewCommandSchema.safeParse({ commandId: uuid, action: "delete", id: uuid })
      .success,
  ).toBe(false);
  expect(
    ViewCommandSchema.safeParse({
      commandId: uuid,
      action: "create",
      name: " ",
      filters: {},
    }).success,
  ).toBe(false);
});
