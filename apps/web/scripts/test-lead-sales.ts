/** Sales priority, evidence and quote state on an isolated local database. No external research calls. */
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { localTestDatabaseURL } from "./local-test-database";
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = "lead-sales-local-secret-1234567890";
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal(
    (await db`SELECT current_database() AS name`)[0].name,
    "renkflow_test",
  );
  const leads = await import("../lib/features/field/leads.server"),
    context = await import("../lib/features/field/sales-context.server");
  const { salesPriority, SalesProfileSchema } =
    await import("../lib/features/field/sales-context");
  const { PostgresQuotationService } =
    await import("../lib/features/quotations/postgres.service");
  const { reviseQuote } = await import("../lib/features/sales/quotes.server");
  const [t] =
    await db`INSERT INTO tenants(name,slug) VALUES('Lead sales',${randomUUID()}) RETURNING id`;
  const [u] =
    await db`INSERT INTO users(name,email) VALUES('Owner',${randomUUID() + "@test.invalid"}) RETURNING id`;
  const [o] =
    await db`INSERT INTO users(name,email) VALUES('Sales',${randomUUID() + "@test.invalid"}) RETURNING id`;
  const [w] =
    await db`INSERT INTO users(name,email) VALUES('Worker',${randomUUID() + "@test.invalid"}) RETURNING id`;
  await db`INSERT INTO tenant_members(tenant_id,user_id,role) VALUES(${t.id},${u.id},'owner'),(${t.id},${o.id},'office'),(${t.id},${w.id},'worker')`;
  const actor = { tenantId: t.id, userId: u.id, role: "owner" as const },
    office = { tenantId: t.id, userId: o.id, role: "office" as const },
    worker = { tenantId: t.id, userId: w.id, role: "worker" as const };
  const profile = SalesProfileSchema.parse({
    country: "DE",
    city: "Berlin",
    customerType: "corporate",
    interests: [{ product: "Pistonlu rüzgâr kırıcı", quantity: 1 }],
  });
  assert.equal(
    salesPriority(profile).level,
    "high",
    "one foreign Starbucks branch is high, not a dealership",
  );
  assert.equal(
    salesPriority({ ...profile, dealerPotential: true }).level,
    "very_high",
  );
  assert.equal(salesPriority({ ...profile, country: "TR" }).level, "medium");
  assert.equal(
    salesPriority({ ...profile, customerType: "individual" }).level,
    "low",
  );
  const input = {
    title: "Starbucks şubesi pistonlu ürün talebi",
    contactName: "Branch manager",
    companyName: "Starbucks Berlin",
    phone: "+49 (30) 12345678",
    email: "branch@example.invalid",
    salesProfile: profile,
  };
  const lead = await leads.createLead(actor, input);
  let current = await leads.getLead(actor, lead.id);
  assert.equal(current.priority.level, "high");
  await assert.rejects(
    leads.createLead(actor, { ...input, phone: "0049 30 12345678" }),
    /Aynı telefon veya e-posta/,
  );
  await leads.createLead(actor, {
    ...input,
    title: "Ayrı proje",
    duplicateReason: "Aynı firmanın ayrı proje talebi",
  });
  await assert.rejects(
    context.leadSalesContext(worker, lead.id),
    (e: any) => e.status === 403,
  );
  let c = await context.leadSalesContext(actor, lead.id);
  assert(c.available);
  assert.equal(c.research.verified, 0);
  assert.equal(
    c.priority.level,
    "high",
    "lack of research does not reduce sales priority",
  );
  const source = {
    category: "projects",
    url: "https://example.invalid/public-project",
    title: "Synthetic public branch reference",
    findings:
      "Synthetic fixture: one branch and a piston windbreaker request; no dealer intent.",
    status: "reported",
    checkedAt: new Date().toISOString(),
  };
  const sourceCommand = { commandId: randomUUID(), source };
  c = await context.saveResearchSource(actor, lead.id, sourceCommand);
  assert(c.available);
  assert.equal(c.sources.length, 1);
  c = await context.saveResearchSource(actor, lead.id, sourceCommand);
  assert(c.available);
  assert.equal(c.sources.length, 1);
  const original = c.sources[0];
  c = await context.saveResearchSource(office, lead.id, {
    commandId: randomUUID(),
    id: original.id,
    version: original.version,
    source: { ...source, status: "verified" },
  });
  assert(c.available);
  assert.equal(c.research.verified, 1);
  assert.equal(c.research.coverage.length, 1);
  assert.equal(c.priority.level, "high");
  const version = c.version;
  c = await context.saveLeadSalesContext(actor, lead.id, {
    version,
    profile,
    ownerId: o.id,
    override: {
      level: "very_high",
      reason: "Confirmed separate multi-site opportunity recorded by sales",
    },
  });
  assert(c.available);
  assert.equal(c.priority.manual, true);
  await assert.rejects(
    context.saveLeadSalesContext(actor, lead.id, {
      version,
      profile,
      override: null,
    }),
    /Kayıt değişti/,
  );
  c = await context.saveLeadSalesContext(actor, lead.id, {
    version: c.version,
    profile,
    override: null,
  });
  assert(c.available);
  assert.equal(c.priority.level, "high");
  const converted = await leads.convertLead(actor, lead.id);
  current = await leads.getLead(actor, lead.id);
  assert.equal(current.quotationId, converted.quotationId);
  const quotes = new PostgresQuotationService();
  let other = await quotes.createQuotation(
    t.id,
    {
      customerId: current.customerId!,
      customerName: input.companyName,
      currency: "TRY",
      discountPercent: 0,
      items: [
        {
          productName: "Pistonlu rüzgâr kırıcı",
          quantity: 1,
          unitPrice: 1200,
          totalPrice: 1200,
          discountPercent: 0,
        },
      ],
    } as any,
    u.id,
  );
  other = await quotes.updateStatus(
    t.id,
    other.id,
    "sent",
    other.version,
    u.id,
    "owner",
  );
  other = await quotes.updateStatus(
    t.id,
    other.id,
    "accepted",
    other.version,
    u.id,
    "owner",
  );
  c = await context.linkLeadQuotation(actor, lead.id, other.id);
  assert(c.available);
  assert.equal(c.quotes.length, 2);
  assert.equal(
    (await leads.getLead(actor, lead.id)).stage,
    "won",
    "a linked approved quote wins the opportunity",
  );
  await reviseQuote(
    actor,
    other.id,
    "Ürün ve adet müşteriyle yeniden görüşülecek",
  );
  assert.equal(
    (await leads.getLead(actor, lead.id)).stage,
    "quoted",
    "quote revision reopens the existing opportunity",
  );
  c = await context.leadSalesContext(actor, lead.id);
  assert(c.available);
  assert.equal(c.quotes.find((q: any) => q.id === other.id)!.history.length, 1);
  let primary = await quotes.getQuotationById(t.id, converted.quotationId);
  primary = await quotes.updateStatus(
    t.id,
    primary!.id,
    "sent",
    primary!.version,
    u.id,
    "owner",
  );
  await quotes.updateStatus(
    t.id,
    primary.id,
    "accepted",
    primary.version,
    u.id,
    "owner",
  );
  assert.equal((await leads.getLead(actor, lead.id)).stage, "won");
  const report = await leads.leadReport(actor);
  assert.equal(report.overall.won, 1);
  assert.equal(
    (
      await db`SELECT COUNT(*)::int AS n FROM work_orders WHERE tenant_id=${t.id}`
    )[0].n,
    0,
  );
  console.log(
    "PASS: evidence-separated priority, foreign single-branch example, duplicate detection, role boundary, version conflicts, sources, linked quote decisions and revisions",
  );
  await db.end();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
