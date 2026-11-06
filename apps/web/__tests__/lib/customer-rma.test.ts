import {
  CustomerRmaInput,
  CustomerRmaDecision,
} from "@/lib/features/manufacturing/customer-rma";
const base = {
  sourceLineId: "8c897dbc-52db-4c58-9a74-570060661713",
  quantity: 1,
  reason: "Profil hasarı",
  idempotencyKey: "fae390d0-7da2-43ae-8624-334250225d65",
};
describe("Customer RMA input boundary", () => {
  test.each([0, -1, NaN, Infinity, 0.0000001])(
    "rejects invalid quantity %s",
    (quantity) =>
      expect(CustomerRmaInput.safeParse({ ...base, quantity }).success).toBe(
        false,
      ),
  );
  test("requires a reason and valid source/photo references", () => {
    expect(CustomerRmaInput.safeParse({ ...base, reason: " " }).success).toBe(
      false,
    );
    expect(
      CustomerRmaInput.safeParse({ ...base, photoAttachmentId: "url" }).success,
    ).toBe(false);
    expect(CustomerRmaInput.parse({ ...base, quantity: 2.5 }).quantity).toBe(
      2.5,
    );
  });
  test.each(["repair", "replace", "reject"])(
    "accepts explicit human decision %s",
    (decision) =>
      expect(CustomerRmaDecision.parse({ decision }).decision).toBe(decision),
  );
  test.each(["pending", "approved", "produce"])(
    "rejects unsupported decision %s",
    (decision) =>
      expect(CustomerRmaDecision.safeParse({ decision }).success).toBe(false),
  );
});
