import { z } from "zod";
import { RESEARCH_CATEGORIES } from "@/lib/features/field/sales-context";

export const COMPANY_RESEARCH_MAX_SEARCHES = 3;
export const COMPANY_RESEARCH_SEARCH_USD = 0.01;
export const CompanyResearchQuery = z
  .object({
    companyName: z.string().trim().min(2).max(180),
    country: z.string().regex(/^[A-Z]{2}$/),
    city: z.string().trim().max(100),
  })
  .strict();
export type CompanyResearchQuery = z.infer<typeof CompanyResearchQuery>;
export type CompanyEvidence = { url: string; title: string; quote: string };
export const ResearchClassification = z
  .object({
    sources: z
      .array(
        z
          .object({
            index: z.number().int().nonnegative().max(11),
            category: z.enum(RESEARCH_CATEGORIES),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

/** Only provider citations into actual search results count as evidence. Model prose is discarded. */
export function researchEvidence(content: unknown): {
  sources: CompanyEvidence[];
  errors: string[];
} {
  const blocks = z.array(z.unknown()).parse(content),
    urls = new Map<string, string>(),
    errors: string[] = [];
  for (const value of blocks) {
    const b = value as any;
    if (b?.type !== "web_search_tool_result") continue;
    if (Array.isArray(b.content))
      for (const result of b.content) {
        const url = publicSourceUrl(result?.url);
        if (result?.type === "web_search_result" && url) {
          const title =
            typeof result.title === "string"
              ? result.title.trim().slice(0, 200)
              : "";
          urls.set(
            url,
            title.length >= 2 ? title : title ? "Kaynak: " + title : "Kaynak",
          );
        }
      }
    else if (typeof b.content?.error_code === "string")
      errors.push(b.content.error_code);
  }
  const sources: CompanyEvidence[] = [],
    seen = new Set<string>();
  for (const value of blocks) {
    const b = value as any;
    if (b?.type !== "text" || !Array.isArray(b.citations)) continue;
    for (const citation of b.citations) {
      const url = publicSourceUrl(citation?.url);
      if (
        citation?.type !== "web_search_result_location" ||
        !url ||
        !urls.has(url) ||
        typeof citation.cited_text !== "string"
      )
        continue;
      const quote = citation.cited_text.trim().slice(0, 500),
        key = url + "|" + quote;
      if (quote.length < 5 || seen.has(key)) continue;
      seen.add(key);
      sources.push({ url, title: urls.get(url)!, quote });
      if (sources.length === 12) return { sources, errors };
    }
  }
  return { sources, errors };
}

export function publicSourceUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try {
    const u = new URL(raw),
      host = u.hostname.toLowerCase();
    if (
      !["https:", "http:"].includes(u.protocol) ||
      u.username ||
      u.password ||
      (u.port && !["80", "443"].includes(u.port)) ||
      !host.includes(".") ||
      /^\d+(?:\.\d+){3}$/.test(host) ||
      host.includes(":") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)
    )
      return null;
    u.hash = "";
    const normalized = u.toString();
    return normalized.length <= 2000 ? normalized : null;
  } catch {
    return null;
  }
}
