import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockApi } from "./mock-api.ts";

describe("mock tenant subscription behavior", () => {
  it("rejects live-only subscription mutations without changing mock subscription state", async () => {
    const api = createMockApi();
    const tenants = await api.listTenants({ page: 1, pageSize: 1 });
    const tenantId = tenants.items[0]?.id;
    assert.ok(tenantId);

    const before = await api.getTenantSubscription(tenantId);
    await assert.rejects(
      () => api.updateTenantSubscriptionOverrides(tenantId, { tpsLimitOverride: 25 }),
      /only available in live mode/,
    );
    await assert.rejects(
      () => api.setTenantSubscriptionChannelOverride(tenantId, "sms", { enabledOverride: false }),
      /only available in live mode/,
    );
    await assert.rejects(
      () => api.clearTenantSubscriptionChannelOverride(tenantId, "sms"),
      /only available in live mode/,
    );
    await assert.rejects(
      () => api.cancelTenantSubscription(tenantId),
      /only available in live mode/,
    );
    await assert.rejects(
      () => api.getTenantSubscriptionHistory(tenantId, { page: 1, pageSize: 20 }),
      /only available in live mode/,
    );
    const after = await api.getTenantSubscription(tenantId);

    assert.deepEqual(after, before);
  });
});
