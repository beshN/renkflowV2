import {
  nextSupplierReturnStatus,
  SupplierReturnInput,
} from "@/lib/features/manufacturing/supplier-return";
describe("supplier returns", () => {
  it("permits exactly the two forward transitions", () => {
    const states = ["draft", "sent", "closed"];
    for (const from of states)
      for (const to of states)
        expect(nextSupplierReturnStatus(from, to)).toBe(
          (from === "draft" && to === "sent") ||
            (from === "sent" && to === "closed"),
        );
  });
  it("refuses unit overrides and invalid quantities", () => {
    const valid = {
      sourceLineId: "00000000-0000-4000-8000-000000000001",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      quantity: 1,
    };
    expect(SupplierReturnInput.safeParse(valid).success).toBe(true);
    for (const quantity of [0, -1, NaN, Infinity, 1.0000001])
      expect(
        SupplierReturnInput.safeParse({ ...valid, quantity }).success,
      ).toBe(false);
    expect(SupplierReturnInput.safeParse({ ...valid, uom: "kg" }).success).toBe(
      false,
    );
  });
});
