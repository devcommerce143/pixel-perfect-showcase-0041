import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockApi } from "./mock/mock-api.ts";

describe("mock tenant detail API", () => {
  it("returns an existing enriched mock tenant and reports a missing tenant", async () => {
    const mockApi = createMockApi();
    const catalog = await mockApi.listTenants({ page: 1, pageSize: 100 });
    const listed = catalog.items[0];
    assert.ok(listed);

    const detail = await mockApi.getTenant(listed.id);

    assert.equal(detail.id, listed.id);
    assert.ok(detail.primaryAdminUserId);
    assert.ok("planName" in detail);
    assert.ok("primaryAdministrator" in detail);
    const subscriptionView = await mockApi.getTenantSubscription(listed.id);
    assert.equal(subscriptionView.subscription?.tenantId, listed.id);
    assert.equal(subscriptionView.subscription?.plan.id, subscriptionView.effective.planId);
    assert.equal(subscriptionView.effective.channels.length, 3);
    const inactive = catalog.items.find((tenant) => tenant.status === "inactive");
    if (inactive) {
      const inactiveView = await mockApi.getTenantSubscription(inactive.id);
      assert.equal(inactiveView.subscription, null);
      assert.ok(inactiveView.effective.blockers.includes("SUBSCRIPTION_MISSING"));
      assert.equal(inactiveView.effective.planId, null);
    }
    await assert.rejects(() => mockApi.getTenant("missing"), /Tenant was not found/);
    await assert.rejects(() => mockApi.getTenantSubscription("missing"), /Tenant was not found/);
  });

  it("keeps plan assignment live-only without changing mock subscriptions", async () => {
    const mockApi = createMockApi();
    const catalog = await mockApi.listTenants({ page: 1, pageSize: 100 });
    const tenant = catalog.items[0];
    assert.ok(tenant);
    const before = await mockApi.getTenantSubscription(tenant.id);

    await assert.rejects(
      () => mockApi.assignTenantPlan(tenant.id, { planId: before.subscription!.planId, status: "active" }),
      /Plan assignment is only available in live mode/,
    );

    const after = await mockApi.getTenantSubscription(tenant.id);
    assert.deepEqual(after, before);
  });

  it("preserves mock tenant creation with its assigned plan and enriched result", async () => {
    const mockApi = createMockApi();
    const planPage = await mockApi.listPlans({ page: 1, pageSize: 100 });
    const plan = planPage.items.find((item) => item.status === "active");
    assert.ok(plan);

    const created = await mockApi.createTenant({
      code: "MOCK-CREATE",
      name: "Mock created tenant",
      status: "trial",
      region: "KSA-Central",
      dataRegion: "KSA-Central",
      defaultLanguage: "en",
      timezone: "Asia/Riyadh",
      notes: "",
      planId: plan.id,
      overrides: null,
      primaryAdministrator: {
        email: "new-admin@example.test",
        firstName: "New",
        lastName: "Admin",
        preferredLanguage: "en",
      },
    });

    assert.ok("subscription" in created);
    assert.equal(created.subscription.planId, plan.id);
    assert.equal(created.primaryAdministrator?.email, "new-admin@example.test");
    assert.equal(created.planName, plan.name);
    assert.equal(created.users, 1);

    const beforeProfileUpdate = await mockApi.getTenantSubscription(created.id);
    const profile = await mockApi.updateTenantProfile(created.id, {
      name: "Mock profile update",
      notes: null,
      defaultLanguage: "ar",
      timezone: "Europe/London",
    });
    assert.equal(profile.name, "Mock profile update");
    assert.equal(profile.notes, null);
    assert.equal(profile.defaultLanguage, "ar");
    assert.equal(profile.timezone, "Europe/London");
    const afterProfileUpdate = await mockApi.getTenantSubscription(created.id);
    assert.equal(afterProfileUpdate.subscription?.planId, beforeProfileUpdate.subscription?.planId);

    const broadlyUpdated = await mockApi.updateTenant(created.id, {
      code: created.code,
      name: "Mock broad update",
      status: created.status,
      region: created.region,
      dataRegion: created.dataRegion,
      defaultLanguage: "en",
      timezone: "Asia/Riyadh",
      notes: "Broad mock update",
      planId: created.subscription.planId,
      overrides: created.subscription.overrides,
      primaryAdministrator: {
        firstName: "Updated",
        lastName: "Administrator",
        email: created.primaryAdministrator!.email,
        preferredLanguage: "en",
      },
    });
    assert.equal(broadlyUpdated.name, "Mock broad update");
    assert.equal(broadlyUpdated.primaryAdministrator?.name, "Updated Administrator");
    assert.equal(broadlyUpdated.subscription.planId, created.subscription.planId);
  });
});
