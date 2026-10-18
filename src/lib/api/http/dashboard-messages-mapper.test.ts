import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DashboardResponseError } from "./dashboard-mapper.ts";
import { mapDashboardMessages } from "./dashboard-messages-mapper.ts";

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    channel: "SMS",
    status: "DELIVERED",
    acceptedAt: "2026-10-17T09:30:00.000Z",
    applicationName: "Dolf LMS",
    templateKey: "otp-login",
    tenantId: "11111111-1111-1111-1111-111111111111",
    tenantName: "Al Noor",
    recipient: "+966500000000",
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    scope: "tenant",
    tenantId: "11111111-1111-1111-1111-111111111111",
    items: [item()],
    ...overrides,
  };
}

describe("dashboard recent messages mapper", () => {
  it("maps channels and keeps SUBMITTED, UNKNOWN, and DISPATCHING distinct", () => {
    const summary = mapDashboardMessages(payload({
      items: [
        item({ id: "sms", channel: "SMS", status: "SUBMITTED" }),
        item({ id: "email", channel: "EMAIL", status: "UNKNOWN", recipient: "user@example.com" }),
        item({ id: "whatsapp", channel: "WHATSAPP", status: "DISPATCHING" }),
        item({ id: "read", channel: "SMS", status: "READ" }),
        item({ id: "failed", channel: "EMAIL", status: "FAILED" }),
      ],
    }));

    assert.deepEqual(summary.items.map((message) => [message.id, message.channel, message.status]), [
      ["sms", "sms", "submitted"],
      ["email", "email", "unknown"],
      ["whatsapp", "whatsapp", "dispatching"],
      ["read", "sms", "read"],
      ["failed", "email", "failed"],
    ]);
  });

  it("keeps the recipient on a tenant response", () => {
    const summary = mapDashboardMessages(payload());
    assert.equal(summary.scope, "tenant");
    assert.equal(summary.items[0]?.recipient, "+966500000000");
    assert.equal(summary.items[0]?.applicationName, "Dolf LMS");
    assert.equal(summary.items[0]?.tenantName, "Al Noor");
    assert.equal(summary.items[0]?.acceptedAt, "2026-10-17T09:30:00.000Z");
    assert.equal(summary.items[0]?.templateKey, "otp-login");
  });

  it("drops a recipient from a platform response", () => {
    const summary = mapDashboardMessages(payload({
      scope: "platform",
      tenantId: null,
      items: [item({ recipient: "+966500000000" })],
    }));
    assert.equal(summary.scope, "platform");
    assert.equal(summary.tenantId, null);
    assert.equal(Object.hasOwn(summary.items[0] ?? {}, "recipient"), false);
    assert.equal(summary.items[0]?.tenantName, "Al Noor");
  });

  it("accepts an empty list", () => {
    const summary = mapDashboardMessages(payload({ items: [] }));
    assert.deepEqual(summary.items, []);
  });

  it("accepts a tenant row whose recipient was omitted", () => {
    const { recipient: _recipient, ...row } = item();
    const summary = mapDashboardMessages(payload({ items: [row] }));
    assert.equal(Object.hasOwn(summary.items[0] ?? {}, "recipient"), false);
  });

  it("rejects an unsupported status or a malformed list", () => {
    assert.throws(() => mapDashboardMessages(payload({ items: [item({ status: "PENDING" })] })), DashboardResponseError);
    assert.throws(() => mapDashboardMessages(payload({ items: [item({ channel: "PUSH" })] })), DashboardResponseError);
    assert.throws(() => mapDashboardMessages({ scope: "tenant", tenantId: null, items: [] }), DashboardResponseError);
    assert.throws(() => mapDashboardMessages(null), DashboardResponseError);
  });
});
