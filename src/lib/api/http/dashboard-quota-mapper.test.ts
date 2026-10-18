import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DashboardResponseError } from "./dashboard-mapper.ts";
import { mapDashboardQuota } from "./dashboard-quota-mapper.ts";

function reading(overrides: Record<string, unknown> = {}) {
  return {
    committed: 40,
    reserved: 10,
    used: 50,
    ceiling: 100,
    band: "NONE",
    overage: 0,
    ...overrides,
  };
}

function tenant(overrides: Record<string, unknown> = {}) {
  return {
    scope: "tenant",
    tenantId: "11111111-1111-1111-1111-111111111111",
    periodStart: "2026-10-01",
    configured: true,
    policy: "HARD_STOP",
    policySource: "plan",
    aggregate: reading(),
    channels: [
      { channel: "SMS", enabled: true, ...reading({ used: 20, committed: 15, reserved: 5 }) },
      { channel: "EMAIL", enabled: true, ...reading({ band: "80", used: 80 }) },
      { channel: "WHATSAPP", enabled: false, ...reading({ ceiling: null, overage: null, used: 0, committed: 0, reserved: 0 }) },
    ],
    ...overrides,
  };
}

describe("dashboard quota mapper", () => {
  it("maps a hard-stop tenant without adding channel usage to the aggregate", () => {
    const summary = mapDashboardQuota(tenant({
      aggregate: reading({ committed: 100, reserved: 20, used: 150, ceiling: 100, band: "100", overage: 50 }),
    }));
    assert.equal(summary.scope, "tenant");
    if (summary.scope !== "tenant") return;
    assert.equal(summary.policy, "hard_stop");
    assert.equal(summary.policySource, "plan");
    assert.equal(summary.aggregate.used, 150);
    assert.equal(summary.aggregate.overage, 50);
    assert.equal(summary.aggregate.band, "100");
    assert.equal(summary.aggregate.used === summary.aggregate.committed + summary.aggregate.reserved, false);
    assert.equal(summary.channels.find((channel) => channel.channel === "sms")?.used, 20);
    assert.equal(summary.channels.find((channel) => channel.channel === "email")?.band, "80");
    assert.equal(summary.channels.find((channel) => channel.channel === "whatsapp")?.enabled, false);
  });

  it("maps a soft cap and keeps overage above the ceiling", () => {
    const summary = mapDashboardQuota(tenant({
      policy: "SOFT_CAP",
      policySource: "subscription",
      aggregate: reading({ used: 180, ceiling: 100, band: "100", overage: 80, committed: 170, reserved: 10 }),
    }));
    if (summary.scope !== "tenant") assert.fail("expected a tenant assessment");
    assert.equal(summary.policy, "soft_cap");
    assert.equal(summary.policySource, "subscription");
    assert.equal(summary.aggregate.used, 180);
    assert.equal(summary.aggregate.overage, 80);
    assert.equal(summary.aggregate.band, "100");
  });

  it("keeps an unconfigured tenant and a null policy", () => {
    const summary = mapDashboardQuota(tenant({
      configured: false,
      policy: null,
      policySource: null,
      aggregate: reading({ used: 12, ceiling: null, band: "NONE", overage: null, committed: 12, reserved: 0 }),
      channels: [],
    }));
    if (summary.scope !== "tenant") assert.fail("expected a tenant assessment");
    assert.equal(summary.configured, false);
    assert.equal(summary.policy, null);
    assert.equal(summary.aggregate.used, 12);
    assert.equal(summary.aggregate.ceiling, null);
    assert.equal(summary.aggregate.band, "none");
    assert.equal(summary.aggregate.overage, null);
  });

  it("maps platform warning counts without a quota percentage", () => {
    const summary = mapDashboardQuota({
      scope: "platform",
      tenantId: null,
      periodStart: "2026-10-01",
      counts: { atOrAbove80: 4, atOrAbove90: 3, atOrAbove100: 1, unconfigured: 2 },
    });
    assert.deepEqual(summary, {
      scope: "platform",
      tenantId: null,
      periodStart: "2026-10-01",
      counts: { atOrAbove80: 4, atOrAbove90: 3, atOrAbove100: 1, unconfigured: 2 },
    });
    assert.equal("quota" in summary, false);
  });

  it("rejects an empty or malformed response", () => {
    assert.throws(() => mapDashboardQuota(null), DashboardResponseError);
    assert.throws(() => mapDashboardQuota({}), DashboardResponseError);
    assert.throws(() => mapDashboardQuota({ scope: "platform", tenantId: null, periodStart: "2026-10-01" }), DashboardResponseError);
    assert.throws(() => mapDashboardQuota(tenant({ policy: "ENTERPRISE" })), DashboardResponseError);
    assert.throws(() => mapDashboardQuota(tenant({
      channels: [
        { channel: "SMS", enabled: true, ...reading() },
        { channel: "SMS", enabled: true, ...reading() },
      ],
    })), DashboardResponseError);
  });
});
