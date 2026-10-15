/** @jest-environment node */
import {
  researchEvidence,
  publicSourceUrl,
  CompanyResearchQuery,
} from "@/lib/ai/company-research";
const citation = {
  type: "web_search_result_location",
  url: "https://example.com/branch",
  cited_text: "This branch serves Berlin.",
  title: "Invented title",
};
const result = {
  type: "web_search_tool_result",
  content: [
    {
      type: "web_search_result",
      url: citation.url,
      title: "Actual result title",
    },
  ],
};
it("keeps only real search-result citations, never model prose or invented links", () => {
  const found = researchEvidence([
    result,
    {
      type: "text",
      text: "Invented turnover and dealer intent",
      citations: [
        citation,
        { ...citation, url: "https://elsewhere.com/" },
        citation,
      ],
    },
  ]);
  expect(found.sources).toEqual([
    {
      url: citation.url,
      title: "Actual result title",
      quote: citation.cited_text,
    },
  ]);
  expect(JSON.stringify(found)).not.toContain("Invented");
  expect(
    researchEvidence([
      {
        type: "text",
        text: "https://example.com/branch",
        citations: [citation],
      },
    ]).sources,
  ).toEqual([]);
});
it("rejects private, credentialed and executable source URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://app.internal/",
    "http://localhost/",
    "https://u:pass@example.com/",
    "https://example.com:8000/",
  ])
    expect(publicSourceUrl(url)).toBeNull();
  expect(publicSourceUrl("https://example.com/branch#x")).toBe(citation.url);
});
it("caps evidence and exposes search errors without treating them as findings", () => {
  const found = researchEvidence([
    result,
    {
      type: "web_search_tool_result",
      content: { error_code: "max_uses_exceeded" },
    },
    {
      type: "text",
      citations: Array.from({ length: 20 }, (_, i) => ({
        ...citation,
        cited_text: String(i) + "x".repeat(600),
      })),
    },
  ]);
  expect(found.sources).toHaveLength(12);
  expect(found.sources.every((s) => s.quote.length === 500)).toBe(true);
  expect(found.errors).toEqual(["max_uses_exceeded"]);
});
it("accepts only the public lookup identity", () => {
  expect(
    CompanyResearchQuery.safeParse({
      companyName: "Example GmbH",
      country: "DE",
      city: "Berlin",
      contactEmail: "private@example.com",
    }).success,
  ).toBe(false);
});
