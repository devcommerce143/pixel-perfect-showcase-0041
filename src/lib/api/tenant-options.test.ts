import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { describe, it } from "node:test";
import { createMockApi } from "./mock/mock-api.ts";
import {
  eligibleTenantOptions,
  fetchCompleteTenantCatalog,
  isActiveTenant,
  shouldClearTenantSelection,
  tenantOptionsQueryOptions,
  TenantOptionsCatalogError,
} from "./tenant-options.ts";
import type { Paginated, TenantCatalogItem, TenantListQuery } from "./types.ts";

function tenant(id: string, status: TenantCatalogItem["status"] = "active", name = id): TenantCatalogItem {
  return {
    id,
    code: id.toUpperCase(),
    name,
    status,
    dataRegion: "me-central",
    defaultLanguage: "en",
    timezone: "Asia/Riyadh",
    notes: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };
}

function page(items: TenantCatalogItem[], pageNumber: number, total: number): Paginated<TenantCatalogItem> {
  return { items, page: pageNumber, pageSize: 100, total };
}

describe("complete tenant options catalog", () => {
  it("accepts an empty catalog without requesting a second page", async () => {
    const requested: number[] = [];
    const result = await fetchCompleteTenantCatalog(async (query) => {
      requested.push(query.page ?? 1);
      return page([], query.page ?? 1, 0);
    });

    assert.deepEqual(result, []);
    assert.deepEqual(requested, [1]);
  });

  it("terminates after exactly one full page", async () => {
    const requested: number[] = [];
    const items = Array.from({ length: 100 }, (_, index) => tenant(`tenant-${index}`));
    const result = await fetchCompleteTenantCatalog(async (query) => {
      requested.push(query.page ?? 1);
      return page(items, query.page ?? 1, 100);
    });

    assert.equal(result.length, 100);
    assert.deepEqual(requested, [1]);
  });

  it("loads pages sequentially through the returned total using the 100-item maximum", async () => {
    const requested: TenantListQuery[] = [];
    const tenants = Array.from({ length: 205 }, (_, index) => tenant(`tenant-${index}`));
    const result = await fetchCompleteTenantCatalog(async (query) => {
      requested.push(query);
      const start = ((query.page ?? 1) - 1) * 100;
      return page(tenants.slice(start, start + 100), query.page ?? 1, tenants.length);
    });

    assert.equal(result.length, 205);
    assert.deepEqual(requested.map((query) => query.page), [1, 2, 3]);
    assert.deepEqual(requested.map((query) => query.pageSize), [100, 100, 100]);
    assert.ok(requested.every((query) => query.filters?.status === "all"));
    assert.ok(requested.every((query) => query.sortBy === "name" && query.sortDirection === "asc"));
  });

  it("rejects inconsistent, invalid, or duplicate page responses instead of returning a partial catalog", async () => {
    await assert.rejects(
      () => fetchCompleteTenantCatalog(async () => page([tenant("one")], 2, 1)),
      TenantOptionsCatalogError,
    );
    await assert.rejects(
      () => fetchCompleteTenantCatalog(async () => ({
        ...page([], 1, 0),
        pageSize: 101,
      })),
      TenantOptionsCatalogError,
    );
    await assert.rejects(
      () => fetchCompleteTenantCatalog(async () => ({
        ...page([], 1, 0),
        pageSize: 50,
      })),
      TenantOptionsCatalogError,
    );
    await assert.rejects(
      () => fetchCompleteTenantCatalog(async () => page([tenant("one")], 1, 2)),
      TenantOptionsCatalogError,
    );
    await assert.rejects(
      () => fetchCompleteTenantCatalog(async (query) => {
        const pageNumber = query.page ?? 1;
        return page(
          pageNumber === 1
            ? Array.from({ length: 100 }, (_, index) => tenant(index === 0 ? "same" : `tenant-${index}`))
            : [tenant("same")],
          pageNumber,
          101,
        );
      }),
      TenantOptionsCatalogError,
    );
  });

  it("rejects a total that changes between pages", async () => {
    await assert.rejects(
      () => fetchCompleteTenantCatalog(async (query) => {
        const pageNumber = query.page ?? 1;
        return page(
          pageNumber === 1
            ? Array.from({ length: 100 }, (_, index) => tenant(`tenant-${index}`))
            : Array.from({ length: 2 }, (_, index) => tenant(`later-${index}`)),
          pageNumber,
          pageNumber === 1 ? 101 : 102,
        );
      }),
      TenantOptionsCatalogError,
    );
  });

  it("propagates a later page request failure without returning earlier pages", async () => {
    let calls = 0;
    const failure = new Error("Page request failed");
    await assert.rejects(
      () => fetchCompleteTenantCatalog(async (query) => {
        calls += 1;
        if (query.page === 2) throw failure;
        return page(Array.from({ length: 100 }, (_, index) => tenant(`tenant-${index}`)), 1, 101);
      }),
      (error: unknown) => error === failure,
    );
    assert.equal(calls, 2);
  });

  it("shares cached results and refreshes them through tenant-prefix invalidation", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let calls = 0;
    const listTenants = async (query: TenantListQuery) => {
      calls += 1;
      return page([tenant(`tenant-${calls}`)], query.page ?? 1, 1);
    };
    const options = tenantOptionsQueryOptions(listTenants);

    assert.equal((await queryClient.fetchQuery(options))[0]?.id, "tenant-1");
    assert.equal((await queryClient.fetchQuery(options))[0]?.id, "tenant-1");
    assert.equal(calls, 1);

    await queryClient.invalidateQueries({ queryKey: ["tenants"] });
    assert.equal((await queryClient.fetchQuery(options))[0]?.id, "tenant-2");
    assert.equal(calls, 2);
    queryClient.clear();
  });

  it("applies active-only and active-plus-trial eligibility and preserves enriched mock records", async () => {
    const enriched = Object.assign(tenant("active"), { planName: "Gold", users: 8 });
    const catalog = await fetchCompleteTenantCatalog(async () => ({
      ...page([tenant("trial", "trial"), enriched, tenant("suspended", "suspended"), tenant("inactive", "inactive")], 1, 4),
    }));

    assert.deepEqual(eligibleTenantOptions(catalog).map((item) => item.id), ["active"]);
    assert.deepEqual(eligibleTenantOptions(catalog, true).map((item) => item.id), ["active", "trial"]);
    const active = catalog.find((item) => item.id === "active") as (TenantCatalogItem & { planName?: string; users?: number });
    assert.equal(active.planName, "Gold");
    assert.equal(active.users, 8);
  });

  it("preserves the mock API's tenant search, status filtering, sorting, and enrichment", async () => {
    const mockApi = createMockApi();
    const all = await mockApi.listTenants({
      page: 1,
      pageSize: 100,
      sortBy: "name",
      sortDirection: "asc",
    });
    const filtered = await mockApi.listTenants({
      page: 1,
      pageSize: 100,
      search: "Red Sea",
      filters: { status: "trial" },
      sortBy: "name",
      sortDirection: "asc",
    });
    const descending = await mockApi.listTenants({
      page: 1,
      pageSize: 100,
      filters: { status: "active" },
      sortBy: "name",
      sortDirection: "desc",
    });

    assert.equal(all.total, 10);
    assert.ok(all.items.every((item) => "planName" in item && "primaryAdministrator" in item));
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0]?.name, "Red Sea Logistics");
    assert.ok(
      (descending.items[0]?.name ?? "").localeCompare(descending.items.at(-1)?.name ?? "", undefined, { numeric: true }) > 0,
    );
  });

  it("preserves mock tenant status updates", async () => {
    const mockApi = createMockApi();
    const catalog = await mockApi.listTenants({ page: 1, pageSize: 100 });
    const tenantToSuspend = catalog.items.find((item) => item.status !== "suspended");
    assert.ok(tenantToSuspend);

    await mockApi.setTenantStatus(tenantToSuspend.id, "suspended");

    const suspended = await mockApi.listTenants({
      page: 1,
      pageSize: 100,
      filters: { status: "suspended" },
    });
    assert.equal(suspended.items.find((item) => item.id === tenantToSuspend.id)?.status, "suspended");
  });

  it("clears a selected tenant only after a complete catalog confirms it is ineligible", () => {
    const catalog = [tenant("trial", "trial"), tenant("suspended", "suspended")];
    assert.equal(shouldClearTenantSelection("suspended", undefined, false), false);
    assert.equal(shouldClearTenantSelection("suspended", catalog, false), false);
    assert.equal(shouldClearTenantSelection("suspended", catalog, true), true);
    assert.equal(shouldClearTenantSelection("trial", catalog, true), false);
  });

  it("requires an active effective tenant for active-only operations", () => {
    const catalog = [tenant("active"), tenant("trial", "trial"), tenant("suspended", "suspended"), tenant("inactive", "inactive")];
    assert.equal(isActiveTenant("active", catalog, true), true);
    assert.equal(isActiveTenant("trial", catalog, true), false);
    assert.equal(isActiveTenant("suspended", catalog, true), false);
    assert.equal(isActiveTenant("inactive", catalog, true), false);
    assert.equal(isActiveTenant("active", catalog, false), false);
    assert.equal(isActiveTenant("missing", catalog, true), false);
  });
});
