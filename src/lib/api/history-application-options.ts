import type { DolfConnectApi } from "./client.ts";
import type { SenderIdentityActor, Paginated, Application, PlatformApplication } from "./types.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";
export interface HistoryApplicationSelection {
  id: string;
  label: string;
  scope: string;
}
/** Use real backend pages; never truncate a legacy application array or substitute fixtures. */
export async function readHistoryApplicationOptions(
  api: Pick<DolfConnectApi, "listApplicationsPage" | "listAllTenantApplications">,
  actor: SenderIdentityActor,
  page: number,
  tenantId?: string,
  allTenants = false,
): Promise<Paginated<Application | PlatformApplication>> {
  const expectedTenant = actor.role === "super_admin" ? tenantId : actor.tenantId;
  if (
    !actor.userId ||
    !Number.isInteger(page) ||
    page < 1 ||
    (allTenants && (actor.role !== "super_admin" || tenantId !== undefined)) ||
    (!allTenants && !isTenantUuid(expectedTenant ?? "")) ||
    (actor.role !== "super_admin" && tenantId !== undefined && tenantId !== actor.tenantId)
  )
    throw new Error("Invalid application filter scope");
  const query = { page, pageSize: 20 };
  const result = await (allTenants
    ? api.listAllTenantApplications(actor, query)
    : api.listApplicationsPage(actor, query, actor.role === "super_admin" ? tenantId : undefined));
  if (!allTenants && result.items.some((row) => row.tenantId !== expectedTenant))
    throw new Error("Application filter tenant mismatch");
  return result;
}
