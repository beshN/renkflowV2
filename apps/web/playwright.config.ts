import { defineConfig, devices } from "@playwright/test";

const localPort = process.env.PLAYWRIGHT_PORT ?? "3100";
const localBaseUrl = `http://127.0.0.1:${localPort}`;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? localBaseUrl,
    trace: "retain-on-failure",
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : { command: `pnpm dev --port ${localPort}`, url: localBaseUrl, reuseExistingServer: false },
});
