import {
  companyAuthRedirect,
  parseCompanyHost,
  validCompanyAddress,
} from "@/lib/features/company/host";
import { mayReadKnowledge } from "@/lib/features/knowledge/contract";
test("company host is one exact DNS label, never a suffix match or forwarded header value", () => {
  expect(parseCompanyHost("RENKALUMINYUM.renkflow.com")).toEqual({
    kind: "company",
    address: "renkaluminyum",
  });
  for (const host of [
    "renkaluminyum.renkflow.com.evil.test",
    "a.b.renkflow.com",
    "renkflow.com@evil.test",
    "a.renkflow.com,evil.test",
    "a.renkflow.com:8080",
    "a_.renkflow.com",
    "-a.renkflow.com",
    "admin.renkflow.com",
    null,
  ])
    expect(parseCompanyHost(host)).toEqual({ kind: "invalid" });
  for (const host of [
    "renkflow.com",
    "www.renkflow.com",
    "panel.renkflow.com",
    "renkflowv2-test.vercel.app",
  ])
    expect(parseCompanyHost(host)).toEqual({ kind: "shared" });
  expect(parseCompanyHost("fab.localhost:3025", true)).toEqual({
    kind: "company",
    address: "fab",
  });
  expect(parseCompanyHost("fab.localhost:3025")).toEqual({ kind: "invalid" });
});
test("reserved system addresses cannot be claimed", () => {
  for (const a of [
    "api",
    "panel",
    "status",
    "mail",
    "admin",
    "a".repeat(64),
    "x.y",
    "çizim",
  ])
    expect(validCompanyAddress(a)).toBe(false);
  expect(validCompanyAddress("renk-aluminyum")).toBe(true);
});
test("knowledge document visibility is enforced for every base role", () => {
  expect(mayReadKnowledge("worker", "company")).toBe(true);
  expect(mayReadKnowledge("worker", "office")).toBe(false);
  expect(mayReadKnowledge("office", "managers")).toBe(false);
  expect(mayReadKnowledge("accountant", "office")).toBe(true);
  expect(mayReadKnowledge("owner", "managers")).toBe(true);
});

test("auth callbacks stay on the company host despite a fixed root auth URL", () => {
  expect(
    companyAuthRedirect(
      "/dashboard",
      "https://renkflow.com",
      "firma.renkflow.com",
      true,
    ),
  ).toBe("https://firma.renkflow.com/dashboard");
  expect(
    companyAuthRedirect(
      "https://renkflow.com/auth/login",
      "https://renkflow.com",
      "firma.renkflow.com",
      true,
    ),
  ).toBe("https://firma.renkflow.com/auth/login");
  for (const url of [
    "https://evil.test/x",
    "//evil.test/x",
    "https://another.renkflow.com/x",
    "/\\evil.test/x",
    "/\t/evil.test/x",
  ])
    expect(
      companyAuthRedirect(
        url,
        "https://renkflow.com",
        "firma.renkflow.com",
        true,
      ),
    ).toBe("https://firma.renkflow.com/dashboard");
});
