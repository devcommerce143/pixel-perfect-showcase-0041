import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPlanPage, PlanCatalogError } from "./plan-mapper.ts";

const plan = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "STANDARD",
  name: "Standard",
  description: "Core messaging",
  status: "ACTIVE",
  defaultTpsLimit: 10,
  defaultQuotaPolicy: "HARD_STOP",
  features: ["API_ACCESS", "REPORTING"],
  channels: [
    { channel: "SMS", enabled: true, monthlyQuota: 25000 },
    { channel: "EMAIL", enabled: true, monthlyQuota: 0 },
    { channel: "WHATSAPP", enabled: false, monthlyQuota: null },
  ],
  tenants: 4,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

describe("plan catalog mapper", () => {
  it("maps status, rate, policy, features, and channel quotas", () => {
    const page = mapPlanPage({ items: [plan], page: 1, pageSize: 20, total: 1 });
    const mapped = page.items[0];
    assert.ok(mapped);
    assert.equal(mapped.status, "active");
    assert.equal(mapped.tpsLimit, 10);
    assert.equal(mapped.quotaPolicy, "hard_stop");
    assert.deepEqual(mapped.features, ["api_access", "reporting"]);
    assert.deepEqual(mapped.entitlements, [
      { channel: "sms", enabled: true, monthly: 25000 },
      { channel: "email", enabled: true, monthly: 0 },
      { channel: "whatsapp", enabled: false, monthly: null },
    ]);
    assert.equal(page.page, 1);
    assert.equal(page.pageSize, 20);
    assert.equal(page.total, 1);
  });

  it("maps a soft-cap plan without inventing a subscriber count", () => {
    const page = mapPlanPage({
      items: [{ ...plan, status: "DRAFT", defaultQuotaPolicy: "SOFT_CAP", defaultTpsLimit: 50, tenants: 9 }],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    const mapped = page.items[0];
    assert.ok(mapped);
    assert.equal(mapped.status, "draft");
    assert.equal(mapped.quotaPolicy, "soft_cap");
    assert.equal(mapped.tpsLimit, 50);
    assert.equal(mapped.tenants, null);
    assert.equal("quota" in mapped, false);
  });

  it("keeps a disabled channel quota null", () => {
    const mapped = mapPlanPage({ items: [plan], page: 1, pageSize: 20, total: 1 }).items[0];
    assert.equal(mapped?.entitlements.find((item) => item.channel === "whatsapp")?.monthly, null);
  });

  it("rejects a disabled channel that still carries a quota", () => {
    const channels = plan.channels.map((channel) => channel.channel === "WHATSAPP" ? { ...channel, monthlyQuota: 0 } : channel);
    assert.throws(
      () => mapPlanPage({ items: [{ ...plan, channels }], page: 1, pageSize: 20, total: 1 }),
      PlanCatalogError,
    );
  });

  it("maps an empty catalog", () => {
    const page = mapPlanPage({ items: [], page: 1, pageSize: 20, total: 0 });
    assert.deepEqual(page.items, []);
    assert.equal(page.total, 0);
  });

  it("rejects an empty or incomplete payload", () => {
    assert.throws(() => mapPlanPage(null), PlanCatalogError);
    assert.throws(() => mapPlanPage({}), PlanCatalogError);
    assert.throws(() => mapPlanPage({ items: [{ ...plan, status: "ENTERPRISE" }], page: 1, pageSize: 20, total: 1 }), PlanCatalogError);
    const duplicate = { ...plan, channels: [...plan.channels, plan.channels[0]] };
    assert.throws(() => mapPlanPage({ items: [duplicate], page: 1, pageSize: 20, total: 1 }), PlanCatalogError);
  });
});
