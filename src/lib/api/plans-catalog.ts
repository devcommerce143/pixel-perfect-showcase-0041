import type { Paginated, PlanListQuery } from "./types.ts";

/** Backend list maximum. A larger requested page is not sent. */
export const PLAN_PAGE_SIZE_MAX = 100;
const PLAN_PAGE_SIZE_DEFAULT = 20;

/** Omit unsupported counts; a known zero remains meaningful. */
export function planTenantCountLabel(
  count: number | null,
  format: (count: number) => string,
): string | undefined {
  return count !== null && Number.isSafeInteger(count) && count >= 0 ? format(count) : undefined;
}

/** Mock screens keep the local plan catalog. Live mode calls GET /plans. */
export function plansCatalogSource(mode: "mock" | "live"): "mock-catalog" | "live-endpoint" {
  return mode === "live" ? "live-endpoint" : "mock-catalog";
}

export function normalizePlanListQuery(query: PlanListQuery = {}): {
  page: number;
  pageSize: number;
} {
  return {
    page: positiveInt(query.page, 1),
    pageSize: Math.min(PLAN_PAGE_SIZE_MAX, positiveInt(query.pageSize, PLAN_PAGE_SIZE_DEFAULT)),
  };
}

/** Query string for GET /plans. Only page and pageSize are included. */
export function planListPath(query: PlanListQuery = {}): string {
  const { page, pageSize } = normalizePlanListQuery(query);
  return `/plans?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) }).toString()}`;
}

/** Pages an already loaded catalog. It does not change each plan's tenant count. */
export function slicePlanPage<T>(rows: readonly T[], query: PlanListQuery = {}): Paginated<T> {
  const { page, pageSize } = normalizePlanListQuery(query);
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

function positiveInt(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isSafeInteger(value) || value < 1) return fallback;
  return value;
}
