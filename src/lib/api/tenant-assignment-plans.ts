import type { Paginated, Plan, PlanListQuery } from "./types.ts";

const PLAN_PAGE_SIZE = 100;

export class TenantAssignmentPlanCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantAssignmentPlanCatalogError";
  }
}

type ListPlans = (query: PlanListQuery) => Promise<Paginated<Plan>>;

export async function fetchCompleteTenantAssignmentPlans(listPlans: ListPlans): Promise<Plan[]> {
  const plans: Plan[] = [];
  const ids = new Set<string>();
  let page = 1;
  let total: number | undefined;

  while (total === undefined || plans.length < total) {
    const result = await listPlans({ page, pageSize: PLAN_PAGE_SIZE });

    if (
      !Number.isSafeInteger(result.page) ||
      result.page !== page ||
      !Number.isSafeInteger(result.pageSize) ||
      result.pageSize !== PLAN_PAGE_SIZE ||
      !Number.isSafeInteger(result.total) ||
      result.total < 0 ||
      !Array.isArray(result.items) ||
      result.items.length > PLAN_PAGE_SIZE
    ) {
      throw new TenantAssignmentPlanCatalogError(`Plan catalog returned invalid pagination metadata for page ${page}.`);
    }
    if (total !== undefined && result.total !== total) {
      throw new TenantAssignmentPlanCatalogError("Plan catalog total changed while loading the catalog.");
    }

    total = result.total;
    const expectedItems = Math.min(PLAN_PAGE_SIZE, Math.max(0, total - plans.length));
    if (result.items.length !== expectedItems) {
      throw new TenantAssignmentPlanCatalogError(`Plan catalog page ${page} was incomplete.`);
    }
    for (const plan of result.items) {
      if (ids.has(plan.id)) {
        throw new TenantAssignmentPlanCatalogError(`Plan catalog contained a duplicate plan on page ${page}.`);
      }
      ids.add(plan.id);
      plans.push(plan);
    }
    page += 1;
  }

  return plans;
}

export function eligibleTenantAssignmentPlans(
  plans: readonly Plan[] | undefined,
  currentPlanId: string | null | undefined,
): Plan[] {
  return (plans ?? []).filter((plan) => plan.status === "active" && plan.id !== currentPlanId);
}
