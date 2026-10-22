import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { tenantPolicyPath, tenantPolicyKey } from "../tenant-policy.ts";
import { ApiError } from "./errors.ts";

const tenant = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const actor = { userId: other, role: "viewer", tenantId: tenant, name: "Viewer" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
function missingSubscription(tenantId = tenant) {
  return {
    subscription: null,
    effective: {
      tenantId,
      tenantStatus: "ACTIVE",
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
      channels: ["SMS", "EMAIL", "WHATSAPP"].map((channel) => ({
        channel,
        enabled: false,
        monthlyQuota: null,
        tpsLimit: null,
        quotaSource: "unavailable",
        tpsSource: "unavailable",
        ignoredOverride: false,
      })),
    },
  };
}

describe("live tenant policy reads", () => {
  it("uses authenticated tenant or explicit named-tenant routes and rejects ambiguous scope", () => {
    assert.equal(tenantPolicyPath(actor), "/subscription");
    assert.equal(tenantPolicyPath(actor, tenant), "/subscription");
    assert.equal(tenantPolicyPath(platform, tenant), `/tenants/${tenant}/subscription`);
    assert.throws(() => tenantPolicyPath(actor, other));
    assert.throws(() => tenantPolicyPath(platform));
    assert.throws(() => tenantPolicyPath(platform, "bad"));
    assert.throws(() => tenantPolicyPath({ ...actor, userId: "" }));
  });

  it("keeps identity, role, own tenant and selected tenant in policy keys", () => {
    const key = tenantPolicyKey(actor);
    assert.notDeepEqual(key, tenantPolicyKey({ ...actor, userId: tenant }));
    assert.notDeepEqual(key, tenantPolicyKey({ ...actor, role: "client_admin" }));
    assert.notDeepEqual(key, tenantPolicyKey({ ...actor, tenantId: other }));
    assert.notDeepEqual(tenantPolicyKey(platform, tenant), tenantPolicyKey(platform, other));
  });

  it("uses human GET and retains unavailable limits without inventing configured defaults", async () => {
    const paths: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "human-token",
      fetchImpl: async (url, init) => {
        paths.push(String(url));
        assert.equal(init?.method, "GET");
        assert.equal(
          (init?.headers as Record<string, string>)["Authorization"],
          "Bearer human-token",
        );
        assert.equal(init?.body, undefined);
        return new Response(JSON.stringify(missingSubscription()));
      },
    });
    const result = await api.getTenantPolicy(actor);
    assert.equal(result.subscription, null);
    assert.equal(result.effective.operational, false);
    assert.equal(result.effective.channels.length, 3);
    for (const row of result.effective.channels) {
      assert.equal(row.monthlyQuota, null);
      assert.equal(row.tpsLimit, null);
      assert.equal(row.enabled, false);
    }
    await api.getTenantPolicy(platform, tenant);
    assert.deepEqual(paths, [
      "https://api.example.test/api/v1/subscription",
      `https://api.example.test/api/v1/tenants/${tenant}/subscription`,
    ]);
  });

  it("rejects foreign tenant responses and unknown contract states", async () => {
    let response = missingSubscription(other);
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => new Response(JSON.stringify(response)),
    });
    await assert.rejects(api.getTenantPolicy(actor));
    await assert.rejects(api.getTenantPolicy(platform, tenant));
    response = missingSubscription();
    response.effective.blockers = ["UNKNOWN_INTERNAL_ERROR"];
    await assert.rejects(api.getTenantPolicy(actor));
  });

  it("surfaces API failures without mock settings or channel defaults", async () => {
    for (const status of [401, 403, 404, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.test/api/v1",
        getAccessToken: () => "token",
        fetchImpl: async () => new Response('{"message":"failed"}', { status }),
      });
      await assert.rejects(api.getTenantPolicy(actor), ApiError);
    }
  });

  it("isolates mock workflows and exposes no live policy mutations or claimed runtime settings", () => {
    for (const route of ["settings", "platform.channels"]) {
      const source = readFileSync(new URL(`../../../routes/${route}.tsx`, import.meta.url), "utf8");
      assert.match(source, /apiMode === "mock"/);
      assert.match(source, /RequirePermission/);
      assert.match(source, /TenantPolicyLive/);
      assert.doesNotMatch(source, /api\.updateSettings|api\.setChannelEnabled/);
    }
    const ui = readFileSync(
      new URL("../../../components/app/TenantPolicyLive.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(ui, /useMutation|api\.|mfaRequired|ipAllowlist|retentionDays|volume30d/);
    assert.match(ui, /queries\.tenantPolicy\(actor, tenantId\)/);
    assert.match(ui, /setLocale\(/);
    assert.match(ui, /policy\.isError/);
  });
});
