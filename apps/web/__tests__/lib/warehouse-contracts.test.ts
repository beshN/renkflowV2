import {
  FactoryCommandSchema,
  parseScanCode,
  assertQuantityPrecision,
} from "@/lib/features/warehouse/contracts";
const id = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
describe("Factory label and stock contract", () => {
  it("resolves the same human barcode and QR token, regardless of deployed host", () => {
    expect(parseScanCode(" rf-l-abcdef012345 ")).toBe("RF-L-ABCDEF012345");
    expect(
      parseScanCode(
        "https://renkflow.example/warehouse/scan?code=RF-L-ABCDEF012345",
      ),
    ).toBe("RF-L-ABCDEF012345");
  });
  it("prioritizes physical unit over parent job in legacy QR labels", () => {
    expect(
      parseScanCode(
        "https://renkflow.example/factory?job=" + id + "&unit=" + other,
      ),
    ).toBe(other);
    expect(parseScanCode("https://renkflow.example/factory?code=" + id)).toBe(
      id,
    );
  });
  it("rejects executable or unbounded input and preserves exact supplier/SKU codes", () => {
    expect(() => parseScanCode("javascript:alert(1)")).toThrow();
    expect(() => parseScanCode("x".repeat(1001))).toThrow();
    expect(() => parseScanCode("https://example.com/unrelated")).toThrow();
    expect(parseScanCode("P-40-BEYAZ")).toBe("P-40-BEYAZ");
  });
  it("rejects identical locations, negative transfers and partial pieces", () => {
    expect(
      FactoryCommandSchema.safeParse({
        action: "transfer",
        data: {
          itemId: id,
          sourceId: id,
          targetId: id,
          quantity: 1,
          version: 1,
        },
      }).success,
    ).toBe(false);
    expect(
      FactoryCommandSchema.safeParse({
        action: "transfer",
        data: {
          itemId: id,
          sourceId: id,
          targetId: other,
          quantity: -1,
          version: 1,
        },
      }).success,
    ).toBe(false);
    expect(() => assertQuantityPrecision(1.5, "adet")).toThrow("tam sayı");
    expect(() => assertQuantityPrecision(1.1234567, "m")).toThrow();
    expect(() => assertQuantityPrecision(1.123456, "m")).not.toThrow();
  });
  it("allows zero counts but requires reason and current snapshot version", () => {
    expect(
      FactoryCommandSchema.safeParse({
        action: "count.submit",
        data: {
          itemId: id,
          locationId: other,
          quantity: 0,
          version: 2,
          reason: "Haftalık raf sayımı",
        },
      }).success,
    ).toBe(true);
    expect(
      FactoryCommandSchema.safeParse({
        action: "count.submit",
        data: {
          itemId: id,
          locationId: other,
          quantity: 0,
          version: 0,
          reason: "x",
        },
      }).success,
    ).toBe(false);
  });
});
