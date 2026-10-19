import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockApi } from "./mock/mock-api.ts";
import { filterTenantDirectory, paginateTenantDirectory } from "./tenant-directory-filter.ts";
import { fetchCompleteTenantCatalog } from "./tenant-options.ts";
import type { Paginated, TenantCatalogItem, TenantListQuery, TenantStatus } from "./types.ts";

function tenant(id: string, status: TenantStatus, name = id, code = id.toUpperCase()): TenantCatalogItem {
  return {
    id,
    code,
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

const statuses: TenantStatus[] = ["trial", "active", "suspended", "inactive"];

describe("tenant directory filtering", () => {
  const catalog = statuses.map((status) =>
    tenant(
      `tenant-${status}`,
      status,
      status === "active" ? "Active Blue Organization" : `${status} Organization`,
      status === "active" ? "alpha-code" : `${status}-code`,
    ),
  );

  it("searches name and tenant code case-insensitively after trimming", () => {
    assert.deepEqual(filterTenantDirectory(catalog, "  aCtIvE bLuE  ", "all").map((item) => item.id), ["tenant-active"]);
    assert.deepEqual(filterTenantDirectory(catalog, "  ALPHA-CODE  ", "all").map((item) => item.id), ["tenant-active"]);
  });

  it("supports every tenant status and all statuses", () => {
    for (const status of statuses) {
      assert.deepEqual(
        filterTenantDirectory(catalog, "", status).map((item) => item.id),
        [`tenant-${status}`],
      );
    }
    assert.deepEqual(filterTenantDirectory(catalog, "", "all"), catalog);
  });

  it("combines search and status filters and returns a distinct empty match set", () => {
    assert.deepEqual(
      filterTenantDirectory(catalog, "organization", "suspended").map((item) => item.id),
      ["tenant-suspended"],
    );
    assert.deepEqual(filterTenantDirectory(catalog, "missing", "all"), []);
    assert.deepEqual(filterTenantDirectory(catalog, "", "all"), catalog);
  });

  it("paginates only after filtering so counts and pages describe the full match set", () => {
    const filtered = filterTenantDirectory(catalog, "", "all");
    assert.deepEqual(paginateTenantDirectory(filtered, 2, 2), {
      items: filtered.slice(2, 4),
      page: 2,
      pageSize: 2,
      total: 4,
    });
  });

  it("filters only after the existing complete-catalog loader has covered all pages", async () => {
    const allTenants = Array.from({ length: 101 }, (_, index) =>
      tenant(`tenant-${index}`, index === 100 ? "active" : "inactive", `Organization ${index}`, `CODE-${index}`),
    );
    const result = await fetchCompleteTenantCatalog(async (query: TenantListQuery) => {
      const pageNumber = query.page ?? 1;
      const start = (pageNumber - 1) * 100;
      return page(allTenants.slice(start, start + 100), pageNumber, allTenants.length);
    });
    assert.deepEqual(filterTenantDirectory(result, "code-100", "active").map((item) => item.id), ["tenant-100"]);

    await assert.rejects(
      () => fetchCompleteTenantCatalog(async (query) => {
        if (query.page === 2) throw new Error("Later page failed");
        return page(allTenants.slice(0, 100), 1, 101);
      }),
      /Later page failed/,
    );
  });

  it("preserves mock directory name/code search and status filtering", async () => {
    const mockApi = createMockApi();
    const all = await mockApi.listTenants({ page: 1, pageSize: 100 });
    const item = all.items[0];
    assert.ok(item);
    const byName = await mockApi.listTenants({
      page: 1,
      pageSize: 100,
      search: `  ${item.name.toUpperCase()}  `.trim(),
      filters: { status: item.status },
    });
    const byCode = await mockApi.listTenants({
      page: 1,
      pageSize: 100,
      search: item.code.toLowerCase(),
      filters: { status: item.status },
    });
    assert.ok(byName.items.some((tenantItem) => tenantItem.id === item.id));
    assert.ok(byCode.items.some((tenantItem) => tenantItem.id === item.id));
    assert.ok(byCode.items.every((tenantItem) => tenantItem.status === item.status));
  });
});
