import type { Paginated, TenantCatalogItem, TenantStatus } from "./types.ts";

export function filterTenantDirectory(
  tenants: readonly TenantCatalogItem[],
  search: string,
  status: TenantStatus | "all",
): TenantCatalogItem[] {
  const normalizedSearch = search.trim().toLowerCase();
  return tenants.filter((tenant) =>
    (status === "all" || tenant.status === status) &&
    (!normalizedSearch ||
      tenant.name.toLowerCase().includes(normalizedSearch) ||
      tenant.code.toLowerCase().includes(normalizedSearch)),
  );
}

export function paginateTenantDirectory(
  tenants: readonly TenantCatalogItem[],
  page: number,
  pageSize: number,
): Paginated<TenantCatalogItem> {
  const start = (page - 1) * pageSize;
  return {
    items: tenants.slice(start, start + pageSize),
    page,
    pageSize,
    total: tenants.length,
  };
}
