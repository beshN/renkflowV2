import { refreshSessionIdentity } from "@/lib/features/auth/session-identity";
import { getSql } from "@/lib/db";
jest.mock("@/lib/db", () => ({ getSql: jest.fn() }));
const query = jest.fn();
const id = "11111111-1111-4111-8111-111111111111",
  tenantId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  (getSql as jest.Mock).mockReturnValue(query);
});
it("returns the live role and canonical identity after a demotion", async () => {
  query.mockResolvedValue([
    {
      id,
      tenant_id: tenantId,
      role: "worker",
      email: "real@example.invalid",
      name: "Current name",
    },
  ]);
  const token = await refreshSessionIdentity({
    id,
    tenantId,
    role: "owner",
    name: "Old name",
    email: "old@example.invalid",
  });
  expect(token).toMatchObject({
    id,
    sub: id,
    tenantId,
    role: "worker",
    name: "Current name",
    email: "real@example.invalid",
  });
  expect(query.mock.calls[0].slice(1)).toEqual([id, tenantId]);
});
it("revokes the signed session after the membership is removed", async () => {
  query.mockResolvedValue([]);
  expect(await refreshSessionIdentity({ id, tenantId })).toBeNull();
});
it("rejects incomplete identities before a database query", async () => {
  expect(await refreshSessionIdentity({ id: "bad", tenantId })).toBeNull();
  expect(query).not.toHaveBeenCalled();
});
it("does not retain a privileged token when identity refresh fails", async () => {
  query.mockRejectedValue(new Error("unavailable"));
  await expect(
    refreshSessionIdentity({ id, tenantId, role: "owner" }),
  ).rejects.toThrow("unavailable");
});
