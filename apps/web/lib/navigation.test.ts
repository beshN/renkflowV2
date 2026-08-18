import { describe, expect, it } from "vitest";
import { safeAppPath } from "@/lib/navigation";

describe("safeAppPath", () => {
  it("keeps internal paths with query strings", () => {
    expect(safeAppPath("/davet?token=abc")).toBe("/davet?token=abc");
  });

  it("rejects absolute, protocol-relative and backslash redirects", () => {
    expect(safeAppPath("https://example.com")).toBe("/panel");
    expect(safeAppPath("//example.com/path")).toBe("/panel");
    expect(safeAppPath("/\\example.com")).toBe("/panel");
  });
});
