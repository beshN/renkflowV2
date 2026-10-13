/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
import {
  assistantContext,
  PRODUCT_KNOWLEDGE,
  ASSISTANT_SEARCH_CATEGORIES,
} from "@/lib/ai/assistant-context";
import { hideAssistantFields } from "@/lib/ai/assistant-records.server";

test("large model context stays valid JSON, protects the open record and reports truncation", () => {
  const currentQuote = {
    quote: { id: "q", quotation_number: "TEK-42" },
    items: [{ product_name: "Pergola", quantity: 2 }],
  };
  const result = assistantContext(
    { currentPath: "/quotations/q" },
    {
      currentQuote,
      orders: Array.from({ length: 40 }, (_, i) => ({
        id: i,
        notes: "x".repeat(3000),
      })),
      scope: "Firma",
      generatedAt: "now",
    },
  );
  expect(result.length).toBeLessThanOrEqual(75000);
  const parsed = JSON.parse(result);
  expect(parsed.verifiedWorkspaceData.currentQuote).toEqual(currentQuote);
  expect(parsed.truncated).toContain("orders");
});
test("visual blobs never enter the text model context and source limitations stay explicit", () => {
  expect(
    assistantContext(
      {},
      { image: "data:image/jpeg;base64," + "A".repeat(10000) },
    ),
  ).not.toContain("A".repeat(1000));
  expect(PRODUCT_KNOWLEDGE).toHaveLength(12);
  expect(
    PRODUCT_KNOWLEDGE.every(
      (p) =>
        p.source.startsWith("https://www.renkaluminyum.com") && !!p.limitation,
    ),
  ).toBe(true);
  expect(ASSISTANT_SEARCH_CATEGORIES).toEqual(
    expect.arrayContaining([
      "quotations",
      "quote-detail",
      "order-detail",
      "recipes",
      "purchases",
      "shipments",
    ]),
  );
});
test("custom hidden fields are recursively stripped from quote and order tool results", () => {
  const clean = hideAssistantFields(
    {
      currentQuote: {
        quote: {
          id: "q",
          customer_name: "Private",
          total_amount: 1200,
          notes: "x",
        },
        items: [
          {
            product_name: "Pergola",
            width_mm: 3000,
            unit_price: 1000,
            cost: 700,
            profit: 300,
            email: "p@test.local",
          },
        ],
      },
    },
    ["price", "cost", "profit", "customer_contact"],
  );
  expect(clean.currentQuote.quote).toEqual({
    id: "q",
    notes: "x",
    financialHidden: true,
  });
  expect(clean.currentQuote.items).toEqual([
    { product_name: "Pergola", width_mm: 3000, financialHidden: true },
  ]);
  expect(hideAssistantFields({ total_amount: 1200 }, [])).toEqual({
    total_amount: 1200,
  });
});
