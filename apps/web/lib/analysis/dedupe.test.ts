import { describe, expect, it } from "vitest";
import { buildAnalysisDedupeKey } from "@/lib/analysis/dedupe";

const base = {
  documentSha256: "a".repeat(64),
  schemaVersion: "v1",
  promptVersion: "p1",
  model: "google/model",
};

describe("analysis idempotency", () => {
  it("returns the same key for the same document and extraction version", () => {
    expect(buildAnalysisDedupeKey(base)).toBe(buildAnalysisDedupeKey({ ...base }));
  });

  it("invalidates cache when prompt, schema, model or content changes", () => {
    expect(buildAnalysisDedupeKey(base)).not.toBe(buildAnalysisDedupeKey({ ...base, promptVersion: "p2" }));
    expect(buildAnalysisDedupeKey(base)).not.toBe(buildAnalysisDedupeKey({ ...base, schemaVersion: "v2" }));
    expect(buildAnalysisDedupeKey(base)).not.toBe(buildAnalysisDedupeKey({ ...base, model: "openai/model" }));
    expect(buildAnalysisDedupeKey(base)).not.toBe(buildAnalysisDedupeKey({ ...base, documentSha256: "b".repeat(64) }));
  });
});
