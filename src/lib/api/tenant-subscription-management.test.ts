import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./http/errors.ts";
import {
  canManageTenantSubscription,
  canStartTenantSubscriptionMutation,
  channelCanBeEnabled,
  isNonNegativeIntegerInput,
  isPositiveIntegerInput,
  tenantSubscriptionMutationErrorMessage,
  tenantSubscriptionRefreshQueryFilters,
} from "./tenant-subscription-management.ts";

describe("tenant subscription management policy", () => {
  it("gates controls to live mode and platform-management permission", () => {
    assert.equal(canManageTenantSubscription("live", true), true);
    assert.equal(canManageTenantSubscription("mock", true), false);
    assert.equal(canManageTenantSubscription("live", false), false);
    assert.equal(canStartTenantSubscriptionMutation("live", true, true, false), true);
    assert.equal(canStartTenantSubscriptionMutation("live", true, false, false), false);
    assert.equal(canStartTenantSubscriptionMutation("live", true, true, true), false);
    assert.equal(canStartTenantSubscriptionMutation("mock", true, true, false), false);
    assert.equal(canStartTenantSubscriptionMutation("live", false, true, false), false);
  });

  it("invalidates the exact current key and only the requested exact history page", () => {
    const query = { page: 3, pageSize: 20 };
    assert.deepEqual(tenantSubscriptionRefreshQueryFilters("tenant-1", query, false), {
      current: { queryKey: ["tenants", "subscription", "tenant-1"], exact: true },
      history: null,
    });
    assert.deepEqual(tenantSubscriptionRefreshQueryFilters("tenant-1", query, true), {
      current: { queryKey: ["tenants", "subscription", "tenant-1"], exact: true },
      history: {
        queryKey: ["tenants", "subscription-history", "tenant-1", 3, 20],
        exact: true,
      },
    });
  });

  it("does not allow an override to enable a channel excluded by its plan", () => {
    assert.equal(channelCanBeEnabled(false, true), false);
    assert.equal(channelCanBeEnabled(false, null), true);
    assert.equal(channelCanBeEnabled(false, false), true);
    assert.equal(channelCanBeEnabled(true, true), true);
  });

  it("validates positive TPS and non-negative quota input", () => {
    assert.equal(isPositiveIntegerInput("1"), true);
    assert.equal(isPositiveIntegerInput("0"), false);
    assert.equal(isPositiveIntegerInput("1.5"), false);
    assert.equal(isPositiveIntegerInput("9007199254740992"), false);
    assert.equal(isNonNegativeIntegerInput("0"), true);
    assert.equal(isNonNegativeIntegerInput("-1"), false);
    assert.equal(isNonNegativeIntegerInput("1.5"), false);
  });

  it("maps mutation failures to localized error keys", () => {
    assert.equal(
      tenantSubscriptionMutationErrorMessage(
        new ApiError({ statusCode: 409, message: "Conflict" }),
      ),
      "ten.subscriptionMutationConflict",
    );
    assert.equal(
      tenantSubscriptionMutationErrorMessage(new Error("offline")),
      "ten.subscriptionMutationError",
    );
  });
});
