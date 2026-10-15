/** Local evidence workflow: the provider boundary is mocked; no paid web calls or real company data. */
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { localTestDatabaseURL } from "./local-test-database";
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = "company-research-local-test-123456789";
  process.env.ANTHROPIC_API_KEY = "synthetic-unused-provider-key";
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS name`)[0].name,
    "renkflow_test",
  );
  const { getAIService } = await import("../lib/ai/service");
  const { researchLeadCompany } =
    await import("../lib/features/field/company-research.server");
  const { leadSalesContext } =
    await import("../lib/features/field/sales-context.server");
  const { saveResearchSource } =
    await import("../lib/features/field/sales-context.server");
  const { createLead } = await import("../lib/features/field/leads.server");
  const { forgetAiSettings } = await import("../lib/ai/gate.server");
  const [tenant] =
    await db`INSERT INTO tenants(name,slug) VALUES('Research fixture',${randomUUID()}) RETURNING id`;
  const [owner] =
    await db`INSERT INTO users(name,email) VALUES('Fixture owner',${randomUUID() + "@test.invalid"}) RETURNING id`;
  const [worker] =
    await db`INSERT INTO users(name,email) VALUES('Fixture worker',${randomUUID() + "@test.invalid"}) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${tenant.id},${owner.id},'owner'),(${tenant.id},${worker.id},'worker')`;
  await db`INSERT INTO ai_settings(tenant_id,mode,kvkk_ack_at) VALUES(${tenant.id},'assist',now())`;
  const a = { tenantId: tenant.id, userId: owner.id, role: "owner" as const },
    w = { ...a, userId: worker.id, role: "worker" as const };
  const lead = await createLead(a, {
    title: "Synthetic opportunity",
    companyName: "Example GmbH",
    contactName: "Private contact",
    email: "private@test.invalid",
    salesProfile: { country: "DE", city: "Berlin", customerType: "corporate" },
  });
  const service = getAIService(),
    original = service.researchCompany;
  let calls = 0,
    hook: (() => Promise<void>) | null = null;
  service.researchCompany = async (query) => {
    calls++;
    assert.deepEqual(query, {
      companyName: "Example GmbH",
      country: "DE",
      city: "Berlin",
    });
    if (hook) await hook();
    return {
      sources: [
        {
          url: "https://example.com/branch",
          title: "Synthetic public branch",
          quote: "The branch serves Berlin.",
          index: 0,
          category: "location",
        },
      ],
      classificationComplete: true,
      incomplete: false,
    };
  };
  await assert.rejects(
    researchLeadCompany(w, lead.id, { commandId: randomUUID() }),
    (e: any) => e.status === 403,
  );
  const command = { commandId: randomUUID() },
    first = await researchLeadCompany(a, lead.id, command);
  assert.equal(first.sourceCount, 1);
  assert.equal(calls, 1);
  assert.deepEqual(await researchLeadCompany(a, lead.id, command), first);
  assert.equal(calls, 1);
  const cachedCommand = { commandId: randomUUID() };
  assert.equal(
    (await researchLeadCompany(a, lead.id, cachedCommand)).cached,
    true,
  );
  assert.equal(calls, 1);
  let c = await leadSalesContext(a, lead.id);
  assert(c.available);
  assert.equal(c.priority.level, "high");
  assert.equal(c.research.verified, 0);
  assert.equal(c.sources.length, 1);
  assert.equal(c.sources[0].status, "reported");
  assert.equal(c.sources[0].evidence.quote, "The branch serves Berlin.");
  const citation = c.sources[0],
    source = {
      category: citation.category,
      url: citation.url,
      title: citation.title,
      findings: citation.findings,
      status: "reported",
      checkedAt: new Date().toISOString(),
    };
  await assert.rejects(
    saveResearchSource(a, lead.id, {
      commandId: randomUUID(),
      id: citation.id,
      version: citation.version,
      source: { ...source, findings: "An invented dealer intent" },
    }),
    /alıntısı değiştirilemez/,
  );
  c = await saveResearchSource(a, lead.id, {
    commandId: randomUUID(),
    id: citation.id,
    version: citation.version,
    source: { ...source, category: "branches" },
  });
  assert(c.available);
  assert.equal(c.sources[0].category, "branches");
  assert.equal(c.sources[0].evidence.quote, citation.evidence.quote);
  await db`UPDATE lead_research_runs SET finished_at=now()-interval '2 days' WHERE tenant_id=${tenant.id}`;
  let release!: () => void, entered!: () => void;
  const ready = new Promise<void>((resolve) => {
      entered = resolve;
    }),
    pause = new Promise<void>((resolve) => {
      release = resolve;
    });
  hook = async () => {
    entered();
    await pause;
  };
  const pending = researchLeadCompany(a, lead.id, { commandId: randomUUID() });
  await ready;
  await assert.rejects(
    researchLeadCompany(a, lead.id, { commandId: randomUUID() }),
    /zaten sürüyor/,
  );
  await db`UPDATE leads SET company_name='Changed company' WHERE id=${lead.id}`;
  release();
  assert.equal((await pending).sourceCount, 0);
  assert.equal(
    (
      await db`SELECT status FROM lead_research_runs WHERE tenant_id=${tenant.id} ORDER BY created_at DESC LIMIT 1`
    )[0].status,
    "stale",
  );
  assert.equal(
    (
      await db`SELECT count(*)::int AS n FROM lead_research_sources WHERE lead_id=${lead.id}`
    )[0].n,
    1,
  );
  // Cached command identities stay replayable even after their original cache expired/context changed.
  assert.equal(
    (await researchLeadCompany(a, lead.id, cachedCommand)).cached,
    true,
  );
  assert.equal(calls, 2);
  await db`UPDATE leads SET company_name='Example GmbH' WHERE id=${lead.id}`;
  await db`UPDATE lead_research_runs SET finished_at=now()-interval '2 days' WHERE tenant_id=${tenant.id}`;
  hook = null;
  await db`UPDATE ai_settings SET daily_budget_usd=0 WHERE tenant_id=${tenant.id}`;
  forgetAiSettings(tenant.id);
  await assert.rejects(
    researchLeadCompany(a, lead.id, { commandId: randomUUID() }),
    /bütçesi doldu/,
  );
  assert.equal(calls, 2);
  await db`UPDATE ai_settings SET daily_budget_usd=NULL WHERE tenant_id=${tenant.id}`;
  forgetAiSettings(tenant.id);
  service.researchCompany = async () => {
    throw new Error("secret provider diagnostics must not escape");
  };
  const failedCommand = { commandId: randomUUID() },
    failed = await researchLeadCompany(a, lead.id, failedCommand);
  assert.equal(failed.sourceCount, 0);
  assert(!failed.message.includes("secret"));
  assert.deepEqual(
    await researchLeadCompany(a, lead.id, failedCommand),
    failed,
  );
  assert.equal(
    (
      await db`SELECT count(*)::int AS n FROM lead_research_sources WHERE lead_id=${lead.id}`
    )[0].n,
    1,
  );
  await db`INSERT INTO ai_usage(tenant_id,user_id,feature,provider,model,cost_usd,tool_cost_usd,web_search_requests,latency_ms,status) VALUES(${tenant.id},${owner.id},'company_research','anthropic','unknown',NULL,.03,3,10,'ok')`;
  await db`UPDATE ai_settings SET daily_budget_usd=.02 WHERE tenant_id=${tenant.id}`;
  forgetAiSettings(tenant.id);
  await assert.rejects(
    researchLeadCompany(a, lead.id, { commandId: randomUUID() }),
    /bütçesi doldu/,
  );
  service.researchCompany = original;
  console.log(
    "PASS: source provenance, live CRM authority, replay/cache without duplicate calls, concurrent claim, changed-context rejection, budget including tool cost, safe failures; provider mocked",
  );
  await db.end();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
