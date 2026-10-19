import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Paginated, Plan, PlanListQuery } from "./types.ts";
import {
  eligibleTenantAssignmentPlans,
  fetchCompleteTenantAssignmentPlans,
  TenantAssignmentPlanCatalogError,
} from "./tenant-assignment-plans.ts";

function plan(id: string, status: Plan["status"] = "active"): Plan {
  return {
    id,
    code: id,
    name: id,
    description: "",
    status,
    tpsLimit: 10,
    tenants: null,
    entitlements: [],
    quotaPolicy: "hard_stop",
    features: [],
  };
}

function page(items: Plan[], pageNumber: number, total: number): Paginated<Plan> {
  return { items, page: pageNumber, pageSize: 100, total };
}

describe("complete tenant-assignment plan catalog", () => {
  it("includes eligible active plans from page two and excludes the current plan", async () => {
    const requested: PlanListQuery[] = [];
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      plan(`first-${index}`, index === 1 ? "draft" : "active"),
    );
    const result = await fetchCompleteTenantAssignmentPlans(async (query) => {
      requested.push(query);
      return query.page === 1
        ? page(firstPage, 1, 101)
        : page([plan("page-two-active")], 2, 101);
    });

    assert.deepEqual(requested, [
      { page: 1, pageSize: 100 },
      { page: 2, pageSize: 100 },
    ]);
    const choices = eligibleTenantAssignmentPlans(result, "first-0");
    assert.ok(choices.some((item) => item.id === "page-two-active"));
    assert.ok(!choices.some((item) => item.id === "first-1"));
    assert.ok(!choices.some((item) => item.id === "first-0"));
  });

  it("rejects a failed later page instead of returning the first page as complete", async () => {
    let calls = 0;
    await assert.rejects(
      () => fetchCompleteTenantAssignmentPlans(async (query) => {
        calls += 1;
        if (query.page === 2) throw new Error("Page request failed");
        return page(Array.from({ length: 100 }, (_, index) => plan(`first-${index}`)), 1, 101);
      }),
      /Page request failed/,
    );
    assert.equal(calls, 2);
  });

  it("rejects incomplete, inconsistent, or duplicate page results", async () => {
    await assert.rejects(
      () => fetchCompleteTenantAssignmentPlans(async (query) =>
        page(query.page === 1 ? [plan("first")] : [], query.page ?? 1, 2),
      ),
      TenantAssignmentPlanCatalogError,
    );
    await assert.rejects(
      () => fetchCompleteTenantAssignmentPlans(async (query) =>
        page(
          query.page === 1
            ? Array.from({ length: 100 }, (_, index) => plan(`first-${index}`))
            : [plan("later")],
          query.page ?? 1,
          query.page === 1 ? 101 : 102,
        ),
      ),
      TenantAssignmentPlanCatalogError,
    );
    await assert.rejects(
      () => fetchCompleteTenantAssignmentPlans(async (query) =>
        page(
          query.page === 1
            ? Array.from({ length: 100 }, (_, index) => plan(index === 0 ? "duplicate" : `first-${index}`))
            : [plan("duplicate")],
          query.page ?? 1,
          101,
        ),
      ),
      TenantAssignmentPlanCatalogError,
    );
  });
});
