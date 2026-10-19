import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTenantUuid } from "./tenant-mapper.ts";
import {
  mapTenantPlanAssignmentResponse,
  mapTenantSubscriptionView,
  TenantSubscriptionResponseError,
  tenantSubscriptionPath,
  tenantSubscriptionQueryKey,
} from "./tenant-subscription-mapper.ts";

const tenantId = "11111111-1111-4111-8111-111111111111";
const planId = "22222222-2222-4222-8222-222222222222";
const subscriptionId = "33333333-3333-4333-8333-333333333333";
const timestamp = "2026-10-01T00:00:00.000Z";

function effective(overrides: Record<string, unknown> = {}) {
  return {
    tenantId,
    tenantStatus: "ACTIVE",
    subscriptionId,
    planId,
    configured: true,
    operational: true,
    blockers: [],
    quotaPolicy: "HARD_STOP",
    quotaPolicySource: "plan",
    tpsLimit: 20,
    tpsSource: "plan",
    features: ["API_ACCESS"],
    channels: [
      { channel: "SMS", enabled: true, monthlyQuota: 1000, tpsLimit: 20, quotaSource: "plan", tpsSource: "plan", ignoredOverride: false },
      { channel: "WHATSAPP", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
      { channel: "EMAIL", enabled: true, monthlyQuota: 300, tpsLimit: 10, quotaSource: "channel", tpsSource: "channel", ignoredOverride: false },
    ],
    ...overrides,
  };
}

function subscription() {
  return {
    id: subscriptionId,
    tenantId,
    planId,
    status: "ACTIVE",
    startsAt: timestamp,
    endsAt: null,
    tpsLimitOverride: 25,
    quotaPolicyOverride: "SOFT_CAP",
    channelOverrides: [
      { channel: "EMAIL", enabledOverride: true, monthlyQuotaOverride: 300, tpsOverride: 10 },
    ],
    plan: {
      id: planId,
      code: "GOLD",
      name: "Gold",
      description: null,
      status: "ACTIVE",
      defaultTpsLimit: 20,
      defaultQuotaPolicy: "HARD_STOP",
      features: ["API_ACCESS"],
      channels: [
        { channel: "SMS", enabled: true, monthlyQuota: 1000 },
        { channel: "WHATSAPP", enabled: false, monthlyQuota: null },
        { channel: "EMAIL", enabled: true, monthlyQuota: 500 },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("tenant subscription view mapper", () => {
  it("maps the current subscription, embedded plan, overrides, and effective entitlements", () => {
    const mapped = mapTenantSubscriptionView(
      { subscription: subscription(), effective: effective() },
      tenantId,
    );
    assert.equal(mapped.subscription?.status, "active");
    assert.equal(mapped.subscription?.plan.name, "Gold");
    assert.equal(mapped.subscription?.plan.tenants, null);
    assert.deepEqual(mapped.subscription?.channelOverrides[0], {
      channel: "email",
      enabledOverride: true,
      monthlyQuotaOverride: 300,
      tpsOverride: 10,
    });
    assert.equal(mapped.effective.quotaPolicy, "hard_stop");
    assert.equal(mapped.effective.channels[0]?.monthlyQuota, 1000);
    assert.equal(mapped.effective.channels[2]?.quotaSource, "channel");
  });

  it("validates the assigned subscription against the requested tenant, plan, and status", () => {
    const mapped = mapTenantPlanAssignmentResponse(
      { subscription: subscription(), effective: effective() },
      tenantId,
      { planId, status: "active" },
    );
    assert.equal(mapped.subscription?.planId, planId);
    assert.equal(mapped.subscription?.status, "active");

    assert.throws(
      () => mapTenantPlanAssignmentResponse(
        { subscription: subscription(), effective: effective() },
        "44444444-4444-4444-8444-444444444444",
        { planId, status: "active" },
      ),
      TenantSubscriptionResponseError,
    );
    assert.throws(
      () => mapTenantPlanAssignmentResponse(
        { subscription: subscription(), effective: effective() },
        tenantId,
        { planId: "44444444-4444-4444-8444-444444444444", status: "active" },
      ),
      TenantSubscriptionResponseError,
    );
    assert.throws(
      () => mapTenantPlanAssignmentResponse(
        { subscription: subscription(), effective: effective() },
        tenantId,
        { planId, status: "trial" },
      ),
      TenantSubscriptionResponseError,
    );
  });

  it("accepts each open current-subscription status", () => {
    for (const status of ["TRIAL", "ACTIVE", "PENDING"] as const) {
      const mapped = mapTenantSubscriptionView({
        subscription: { ...subscription(), status },
        effective: effective({
          configured: true,
          operational: status !== "PENDING",
          blockers: status === "PENDING" ? ["SUBSCRIPTION_PENDING"] : [],
        }),
      });
      assert.equal(mapped.subscription?.status, status.toLowerCase());
    }
  });

  it("rejects a cancelled record as the current subscription", () => {
    assert.throws(
      () => mapTenantSubscriptionView({
        subscription: { ...subscription(), status: "CANCELLED" },
        effective: effective({
          configured: false,
          operational: false,
          blockers: ["SUBSCRIPTION_CANCELLED"],
        }),
      }),
      TenantSubscriptionResponseError,
    );
  });

  it("accepts a null current subscription with valid empty effective entitlements", () => {
    const mapped = mapTenantSubscriptionView({
      subscription: null,
      effective: effective({
        subscriptionId: null,
        planId: null,
        configured: false,
        operational: false,
        blockers: ["SUBSCRIPTION_MISSING"],
        quotaPolicy: null,
        quotaPolicySource: null,
        tpsLimit: null,
        tpsSource: null,
        features: [],
        channels: [
          { channel: "SMS", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
          { channel: "WHATSAPP", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
          { channel: "EMAIL", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
        ],
      }),
    });
    assert.equal(mapped.subscription, null);
    assert.equal(mapped.effective.configured, false);
    assert.equal(mapped.effective.blockers[0], "SUBSCRIPTION_MISSING");
    assert.equal(mapped.effective.quotaPolicy, null);
    assert.equal(mapped.effective.quotaPolicySource, null);
    assert.equal(mapped.effective.tpsLimit, null);
    assert.equal(mapped.effective.tpsSource, null);
    assert.deepEqual(mapped.effective.features, []);
    assert.ok(mapped.effective.channels.every((channel) =>
      !channel.enabled &&
      channel.monthlyQuota === null &&
      channel.tpsLimit === null &&
      channel.quotaSource === "unavailable" &&
      channel.tpsSource === "unavailable",
    ));
  });

  it("accepts combined tenant and subscription blockers with nullable channel entitlements", () => {
    const mapped = mapTenantSubscriptionView({
      subscription: { ...subscription(), status: "PENDING" },
      effective: effective({
        tenantStatus: "SUSPENDED",
        configured: true,
        operational: false,
        blockers: ["TENANT_SUSPENDED", "SUBSCRIPTION_PENDING"],
        channels: [
          { channel: "SMS", enabled: true, monthlyQuota: null, tpsLimit: 20, quotaSource: "plan", tpsSource: "plan", ignoredOverride: false },
          { channel: "WHATSAPP", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
          { channel: "EMAIL", enabled: true, monthlyQuota: 300, tpsLimit: null, quotaSource: "channel", tpsSource: "unavailable", ignoredOverride: false },
        ],
      }),
    });
    assert.equal(mapped.effective.operational, false);
    assert.deepEqual(mapped.effective.blockers, ["TENANT_SUSPENDED", "SUBSCRIPTION_PENDING"]);
    assert.equal(mapped.effective.channels[0]?.monthlyQuota, null);
    assert.equal(mapped.effective.channels[2]?.tpsLimit, null);
  });

  it("rejects effective entitlements inconsistent with a missing subscription", () => {
    const emptyEffective = effective({
      subscriptionId: null,
      planId: null,
      configured: false,
      operational: false,
      blockers: ["SUBSCRIPTION_MISSING"],
      quotaPolicy: null,
      quotaPolicySource: null,
      tpsLimit: null,
      tpsSource: null,
      features: [],
      channels: [
        { channel: "SMS", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
        { channel: "WHATSAPP", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
        { channel: "EMAIL", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
      ],
    });
    assert.throws(
      () => mapTenantSubscriptionView({ subscription: null, effective: { ...emptyEffective, configured: true } }),
      TenantSubscriptionResponseError,
    );
    assert.throws(
      () => mapTenantSubscriptionView({
        subscription: null,
        effective: {
          ...emptyEffective,
          channels: emptyEffective.channels.map((channel) =>
            channel.channel === "SMS" ? { ...channel, enabled: true } : channel,
          ),
        },
      }),
      TenantSubscriptionResponseError,
    );
  });

  it("rejects missing, inconsistent, or malformed response fields", () => {
    const valid = { subscription: subscription(), effective: effective() };
    assert.throws(() => mapTenantSubscriptionView({ subscription: null }), TenantSubscriptionResponseError);
    assert.throws(
      () => mapTenantSubscriptionView({ ...valid, effective: effective({ tenantId: "44444444-4444-4444-8444-444444444444" }) }, tenantId),
      TenantSubscriptionResponseError,
    );
    assert.throws(
      () => mapTenantSubscriptionView({ subscription: subscription(), effective: effective({ subscriptionId: null }) }),
      TenantSubscriptionResponseError,
    );
    assert.throws(
      () => mapTenantSubscriptionView({ subscription: { ...subscription(), startsAt: "bad-date" }, effective: effective() }),
      TenantSubscriptionResponseError,
    );
    assert.throws(
      () => mapTenantSubscriptionView({ subscription: null, effective: effective({ channels: [] }) }),
      TenantSubscriptionResponseError,
    );
  });

  it("builds tenant-prefixed keys and paths and shares backend UUID acceptance", () => {
    assert.deepEqual(tenantSubscriptionQueryKey(tenantId), ["tenants", "subscription", tenantId]);
    assert.equal(tenantSubscriptionPath(tenantId), `/tenants/${tenantId}/subscription`);
    assert.equal(tenantSubscriptionPath("tenant/one"), "/tenants/tenant%2Fone/subscription");
    assert.equal(isTenantUuid(tenantId), true);
    assert.equal(isTenantUuid("tenant-one"), false);
  });
});
