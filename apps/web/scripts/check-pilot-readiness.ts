#!/usr/bin/env tsx
import dotenv from "dotenv";
import postgres from "postgres";
import {
  checkPilotReadiness,
  type Finding,
} from "../lib/features/manufacturing/pilot-readiness";
import { readPilotRows } from "../lib/features/manufacturing/pilot-readiness-reader";
import { pilotReadinessConnection } from "./pilot-readiness-connection";

const json = process.argv.includes("--json");
let connectionType: "yerel" | "uzak" | "bilinmiyor" = "bilinmiyor";
function output(findings: Finding[]) {
  const blockers = findings.filter((f) => f.severity === "blocker").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const message = `${blockers} engel, ${warnings} uyarı. Engel olmaması pilota hazır olunduğu anlamına gelmez.`;
  if (json)
    console.log(
      JSON.stringify(
        { connectionType, findings, summary: { blockers, warnings, message } },
        null,
        2,
      ),
    );
  else {
    console.log(`Bağlantı türü: ${connectionType}`);
    console.table(
      findings.map((f) => ({
        Kod: f.code,
        Önem: { blocker: "Engel", warning: "Uyarı", info: "Bilgi" }[f.severity],
        Bulgu: f.message,
        Öneri: f.hint,
      })),
    );
    console.log(message);
  }
  if (blockers) process.exitCode = 1;
}
async function main() {
  dotenv.config({ path: ".env.local", quiet: true });
  if (!process.env.DATABASE_URL) {
    output([
      {
        code: "DATABASE_CONFIG",
        severity: "blocker",
        message: "DATABASE_URL tanımlı değil.",
        hint: "Ayrı test veritabanı için .env.local dosyasını yapılandırın.",
      },
    ]);
    return;
  }
  const connection = pilotReadinessConnection(process.env.DATABASE_URL);
  connectionType = connection.connectionType;
  if (connectionType === "uzak" && !process.argv.includes("--allow-remote")) {
    output([
      {
        code: "REMOTE_BLOCKED",
        severity: "blocker",
        message: "Uzak veritabanı bağlantısı engellendi.",
        hint: "Yalnız yetkilendirilmiş bir uzak ortam için --allow-remote kullanın.",
      },
    ]);
    return;
  }
  const sql = postgres(connection.url, {
    host: connection.host,
    port: connection.port,
    path: connection.path,
    max: 1,
    prepare: false,
    connect_timeout: 10,
    onnotice: () => {},
  });
  try {
    const findings = await sql.begin("read only", async (tx) => {
      return checkPilotReadiness(await readPilotRows(tx));
    });
    output(findings);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch(() => {
  // Never expose connection URLs, server details, or arbitrary exception messages.
  output([
    {
      code: "READ_FAILED",
      severity: "blocker",
      message: "Pilot hazırlık kontrolü tamamlanamadı.",
      hint: "Bağlantı ayarlarını ve okuma izinlerini güvenli ortamda kontrol edin.",
    },
  ]);
});
