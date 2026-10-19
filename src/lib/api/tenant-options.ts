import { queryOptions } from "@tanstack/react-query";
import type { Paginated, TenantCatalogItem, TenantListQuery } from "./types";

export const TENANT_OPTIONS_QUERY_KEY = ["tenants", "options"] as const;
const TENANT_OPTIONS_PAGE_SIZE = 100;

export class TenantOptionsCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantOptionsCatalogError";
  }
}

type ListTenants = (query: TenantListQuery) => Promise<Paginated<TenantCatalogItem>>;

export async function fetchCompleteTenantCatalog(listTenants: ListTenants): Promise<TenantCatalogItem[]> {
  const items: TenantCatalogItem[] = [];
  const ids = new Set<string>();
  const requestedPages = new Set<number>();
  let page = 1;
  let total: number | undefined;
  let pageSize: number | undefined;

  while (total === undefined || items.length < total) {
    if (requestedPages.has(page)) {
      throw new TenantOptionsCatalogError(`Tenant catalog page ${page} was requested more than once.`);
    }
    requestedPages.add(page);

    const result = await listTenants({
      page,
      pageSize: TENANT_OPTIONS_PAGE_SIZE,
      filters: { status: "all" },
      sortBy: "name",
      sortDirection: "asc",
    });

    if (
      !Number.isSafeInteger(result.page) ||
      result.page !== page ||
      !Number.isSafeInteger(result.pageSize) ||
      result.pageSize !== TENANT_OPTIONS_PAGE_SIZE ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      !Array.isArray(result.items) ||
      result.items.length > result.pageSize
    ) {
      throw new TenantOptionsCatalogError(`Tenant catalog returned invalid pagination metadata for page ${page}.`);
    }
    if (pageSize !== undefined && result.pageSize !== pageSize) {
      throw new TenantOptionsCatalogError("Tenant catalog page size changed while loading the catalog.");
    }
    if (total !== undefined && result.total !== total) {
      throw new TenantOptionsCatalogError("Tenant catalog total changed while loading the catalog.");
    }

    pageSize = result.pageSize;
    total = result.total;
    const expectedItems = Math.min(pageSize, Math.max(0, total - items.length));
    if (result.items.length !== expectedItems) {
      throw new TenantOptionsCatalogError(`Tenant catalog page ${page} was incomplete.`);
    }
    for (const item of result.items) {
      if (ids.has(item.id)) {
        throw new TenantOptionsCatalogError(`Tenant catalog contained a duplicate tenant on page ${page}.`);
      }
      ids.add(item.id);
      items.push(item);
    }
    page += 1;
  }

  return items;
}

export function eligibleTenantOptions(
  tenants: readonly TenantCatalogItem[],
  includeTrial = false,
): TenantCatalogItem[] {
  return tenants
    .filter((tenant) => tenant.status === "active" || (includeTrial && tenant.status === "trial"))
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
}

export function isActiveTenant(
  tenantId: string | undefined,
  catalog: readonly TenantCatalogItem[] | undefined,
  catalogComplete: boolean,
): boolean {
  return Boolean(
    tenantId &&
      catalogComplete &&
      catalog?.some((tenant) => tenant.id === tenantId && tenant.status === "active"),
  );
}

export function shouldClearTenantSelection(
  tenantId: string | undefined,
  catalog: readonly TenantCatalogItem[] | undefined,
  catalogComplete: boolean,
): boolean {
  return Boolean(
    tenantId &&
      catalogComplete &&
      catalog &&
      !eligibleTenantOptions(catalog, true).some((tenant) => tenant.id === tenantId),
  );
}

export function tenantOptionsQueryOptions(listTenants: ListTenants) {
  return queryOptions({
    queryKey: TENANT_OPTIONS_QUERY_KEY,
    queryFn: () => fetchCompleteTenantCatalog(listTenants),
    staleTime: 60_000,
  });
}
