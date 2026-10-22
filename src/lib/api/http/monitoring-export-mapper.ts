import type { SenderIdentityActor } from "../types.ts";
import type { MonitoringExport } from "../monitoring-export.ts";
import {
  messageHistoryListPath,
  platformMessageHistoryListPath,
} from "./message-history-mapper.ts";
import { usageReportPath } from "./usage-report-mapper.ts";
import { isTenantUuid } from "./tenant-mapper.ts";
export function monitoringExportPath(
  actor: SenderIdentityActor,
  request: MonitoringExport,
  tenantId?: string,
) {
  if (
    actor.role !== "super_admin" &&
    (!isTenantUuid(actor.tenantId ?? "") || (tenantId && tenantId !== actor.tenantId))
  )
    throw new Error("Invalid export tenant scope");
  let path: string;
  if (request.kind === "usage") path = usageReportPath(actor, request.range, tenantId);
  else {
    if (request.scope === "all-tenants" && (actor.role !== "super_admin" || tenantId))
      throw new Error("Explicit all-tenant platform export required");
    if (request.scope === "tenant" && actor.role === "super_admin" && !isTenantUuid(tenantId ?? ""))
      throw new Error("A named tenant is required");
    const query = { ...request.query, page: 1, pageSize: 20 };
    path =
      request.scope === "all-tenants"
        ? platformMessageHistoryListPath(query)
        : messageHistoryListPath(query, actor.role === "super_admin" ? tenantId : undefined);
  }
  const [base, raw] = path.split("?");
  const params = new URLSearchParams(raw);
  params.delete("page");
  params.delete("pageSize");
  return `${base}/export?${params.toString()}`;
}
