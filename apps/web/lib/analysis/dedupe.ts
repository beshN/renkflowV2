import { createHash } from "node:crypto";

export function buildAnalysisDedupeKey(input: {
  documentSha256: string;
  schemaVersion: string;
  promptVersion: string;
  model: string;
}) {
  return createHash("sha256")
    .update([input.documentSha256, input.schemaVersion, input.promptVersion, input.model].join(":"))
    .digest("hex");
}
