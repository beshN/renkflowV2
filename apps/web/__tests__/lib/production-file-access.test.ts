/** @jest-environment node */
import { GET } from "@/app/api/v1/production/files/[tenant]/[id]/route";
import { requireWorkOrderActor } from "@/lib/features/work-orders/security";
import { sql } from "@/lib/db";
jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
jest.mock("@/lib/features/work-orders/security", () => ({
  requireWorkOrderActor: jest.fn(),
}));
jest.mock("@/lib/storage", () => ({ readFile: jest.fn() }));
const tenant = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ tenant, id }) };
const actor = (role: "worker" | "owner") =>
  jest
    .mocked(requireWorkOrderActor)
    .mockResolvedValue({ tenantId: tenant, userId: id, role });
const query = () => sql as unknown as jest.Mock;
beforeEach(() => jest.clearAllMocks());
it("keeps the original receipt PDF out of the worker technical view", async () => {
  actor("worker");
  query().mockResolvedValueOnce([
    { id, mime: "application/pdf", body: Buffer.from("%PDF fixture") },
  ]);
  expect((await GET(new Request("http://local"), context)).status).toBe(403);
});
it("also protects invoice images while allowing ordinary job photos", async () => {
  actor("worker");
  const photo = { id, mime: "image/png", body: new Uint8Array([1, 2]) };
  query().mockResolvedValueOnce([photo]).mockResolvedValueOnce([{ id }]);
  expect((await GET(new Request("http://local"), context)).status).toBe(403);
  query().mockResolvedValueOnce([photo]).mockResolvedValueOnce([]);
  expect((await GET(new Request("http://local"), context)).status).toBe(200);
});
it("retains original document access for the authorized office view", async () => {
  actor("owner");
  query().mockResolvedValueOnce([
    { id, mime: "application/pdf", body: Buffer.from("%PDF fixture") },
  ]);
  expect((await GET(new Request("http://local"), context)).status).toBe(200);
});
