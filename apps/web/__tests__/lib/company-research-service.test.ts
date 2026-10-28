/** @jest-environment node */
const create = jest.fn(),
  parse = jest.fn(),
  rows: unknown[][] = [];
jest.mock("server-only", () => ({}));
jest.mock("@anthropic-ai/sdk", () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => ({
      messages: {
        create: (...a: unknown[]) => create(...a),
        parse: (...a: unknown[]) => parse(...a),
      },
    })),
}));
jest.mock("@anthropic-ai/sdk/helpers/zod", () => ({
  zodOutputFormat: () => ({ type: "json_schema" }),
}));
jest.mock("@/lib/db", () => ({
  sql: jest.fn((_s: TemplateStringsArray, ...v: unknown[]) => {
    rows.push(v);
    return Promise.resolve([]);
  }),
}));
jest.mock("@/lib/ai/gate.server", () => ({
  assertModelAllowed: jest.fn(async () => {}),
  reserveModelCall: jest.fn(async () => null),
  releaseModelReservation: jest.fn(async () => {}),
}));
import { AIService } from "@/lib/ai/service";
import { costUsd, toolCostUsd } from "@/lib/ai/usage";
const usage = {
  input_tokens: 100,
  output_tokens: 20,
  server_tool_use: { web_search_requests: 2 },
};
beforeEach(() => {
  jest.clearAllMocks();
  rows.length = 0;
  process.env.ANTHROPIC_API_KEY = "test-company-research-key";
  delete process.env.AI_MODEL_PRICES_USD_PER_MTOK;
  create.mockResolvedValue({
    stop_reason: "end_turn",
    usage,
    content: [
      {
        type: "web_search_tool_result",
        content: [
          {
            type: "web_search_result",
            url: "https://example.com/branch",
            title: "Public branch",
          },
        ],
      },
      {
        type: "text",
        text: "Invented dealer intent",
        citations: [
          {
            type: "web_search_result_location",
            url: "https://example.com/branch",
            cited_text: "Our branch serves Berlin.",
          },
        ],
      },
    ],
  });
  parse.mockResolvedValue({
    parsed_output: { sources: [{ index: 0, category: "location" }] },
    usage: { input_tokens: 20, output_tokens: 5 },
    stop_reason: "end_turn",
  });
});
it("uses a bounded real search and classifies only verbatim evidence", async () => {
  const result = await new AIService().researchCompany(
    { companyName: "Example GmbH", country: "DE", city: "Berlin" },
    { feature: "company_research" },
  );
  expect(create.mock.calls[0][0].tools).toEqual([
    { type: "web_search_20250305", name: "web_search", max_uses: 3 },
  ]);
  expect(create.mock.calls[0][1]).toEqual({ timeout: 60000, maxRetries: 0 });
  expect(result.sources).toEqual([
    {
      url: "https://example.com/branch",
      title: "Public branch",
      quote: "Our branch serves Berlin.",
      index: 0,
      category: "location",
    },
  ]);
  expect(JSON.stringify(parse.mock.calls)).not.toContain(
    "Invented dealer intent",
  );
  expect(rows.some((r) => r.includes(2) && r.includes(0.02))).toBe(true);
  expect(costUsd("claude-sonnet-5-5", usage)).toBe(0.0204);
  expect(costUsd("unknown-model", usage)).toBeNull();
  expect(toolCostUsd(usage)).toBe(0.02);
});
it("keeps cited evidence when classification fails and never creates evidence from model prose", async () => {
  parse.mockRejectedValue(new Error("classification failed"));
  const result = await new AIService().researchCompany(
    { companyName: "Example GmbH", country: "DE", city: "Berlin" },
    { feature: "company_research" },
  );
  expect(result.classificationComplete).toBe(false);
  expect(result.sources[0].category).toBe("activity");
  create.mockResolvedValue({
    stop_reason: "end_turn",
    usage,
    content: [{ type: "text", text: "Invented dealer intent" }],
  });
  expect(
    (
      await new AIService().researchCompany(
        { companyName: "Example GmbH", country: "DE", city: "Berlin" },
        { feature: "company_research" },
      )
    ).sources,
  ).toEqual([]);
});
it("records paid search failures and refuses to invent a fallback", async () => {
  create.mockResolvedValue({
    stop_reason: "end_turn",
    usage,
    content: [
      {
        type: "web_search_tool_result",
        content: { error_code: "unavailable" },
      },
    ],
  });
  await expect(
    new AIService().researchCompany(
      { companyName: "Example GmbH", country: "DE", city: "Berlin" },
      { feature: "company_research" },
    ),
  ).rejects.toMatchObject({ code: "AI_WEB_SEARCH" });
  expect(rows.some((r) => r.includes("error") && r.includes(0.02))).toBe(true);
  expect(parse).not.toHaveBeenCalled();
});
