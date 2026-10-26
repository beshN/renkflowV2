/**
 * @jest-environment node
 *
 * The WhatsApp webhook writes a whole payload in at most three statements, and the collapsed
 * outbox status matches applying each status in order with the `status<>'delivered'` guard.
 */
import { createHmac } from "node:crypto";

const sqlMock = jest.fn(async (..._args: unknown[]) => []);
jest.mock("@/lib/db", () => ({ sql: (...args: unknown[]) => sqlMock(...args) }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/v1/webhooks/whatsapp/route";

const TENANT = "00000000-0000-4000-8000-0000000000aa";
const s = (id: string, status: string, timestamp: string) => ({ id, status, timestamp });

function signed(payload: unknown) {
  const body = JSON.stringify(payload);
  return new NextRequest("http://localhost/api/v1/webhooks/whatsapp", {
    method: "POST",
    body,
    headers: { "x-hub-signature-256": "sha256=" + createHmac("sha256", "secret").update(body).digest("hex") },
  });
}

describe("WhatsApp webhook batching", () => {
  beforeEach(() => {
    sqlMock.mockClear();
    process.env.WHATSAPP_APP_SECRET = "secret";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone";
    process.env.WHATSAPP_INBOUND_TENANT_ID = TENANT;
  });

  it("writes events, outbox status and inbound messages in three statements", async () => {
    const res = await POST(signed({
      object: "whatsapp_business_account",
      entry: [{ changes: [
        { value: { metadata: { phone_number_id: "phone" }, statuses: [s("a", "sent", "1"), s("a", "delivered", "2"), s("c", "sent", "1")], messages: [{ id: "m1" }, { id: "m2" }] } },
        { value: { metadata: { phone_number_id: "someone-else" }, statuses: [s("c", "delivered", "9")], messages: [{ id: "m9" }] } },
        { value: { metadata: { phone_number_id: "phone" }, statuses: [s("a", "failed", "3"), s("c", "read", "2"), s("c", "failed", "3"), s("c", "typing", "4")], messages: [{ id: "m1" }] } },
      ] }],
    }));
    expect(res.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(3);
    const [events, outbox, inbound] = sqlMock.mock.calls.map((c) => ({ text: (c[0] as string[]).join("$"), values: c.slice(1) }));
    expect(events.text).toContain("INSERT INTO notification_delivery_events");
    expect(events.text).toContain("ON CONFLICT DO NOTHING");
    expect(events.values[0]).toEqual(["a:sent:1", "a:delivered:2", "c:sent:1", "a:failed:3", "c:read:2", "c:failed:3"]);
    expect(events.values[2]).toEqual(["sent", "delivered", "sent", "failed", "delivered", "failed"]);
    expect(outbox.text).toContain("UPDATE notification_outbox");
    expect(outbox.text).toContain("o.status<>'delivered'");
    // a: delivered stays even though "failed" arrived later; c: "read" counts as delivered.
    expect(outbox.values).toEqual([["a", "c"], ["delivered", "delivered"]]);
    expect(inbound.text).toContain("INSERT INTO inbound_messages");
    expect(inbound.text).toContain("ON CONFLICT DO NOTHING");
    expect(inbound.values[0]).toBe(TENANT);
    expect(inbound.values[1]).toEqual(["m1", "m2"]);
  });

  it("keeps the last status when nothing was delivered and skips inbound without a tenant", async () => {
    delete process.env.WHATSAPP_INBOUND_TENANT_ID;
    await POST(signed({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone" }, statuses: [s("b", "failed", "1"), s("b", "sent", "2")], messages: [{ id: "m1" }] } }] }],
    }));
    expect(sqlMock).toHaveBeenCalledTimes(2);
    expect(sqlMock.mock.calls[1].slice(1)).toEqual([["b"], ["sent"]]);
  });

  it("writes nothing for an unsigned request or an empty payload", async () => {
    expect((await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await POST(signed({ object: "whatsapp_business_account", entry: [] }))).status).toBe(200);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});
