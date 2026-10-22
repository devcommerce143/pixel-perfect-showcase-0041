import type { MessageHistoryQuery, SenderIdentityActor } from "./types.ts";
import type { UsageReportRange } from "./usage-report.ts";
import { ApiError } from "./http/errors.ts";
export type MonitoringExport =
  | {
      kind: "history";
      scope: "tenant" | "all-tenants";
      query: Omit<MessageHistoryQuery, "page" | "pageSize">;
    }
  | { kind: "usage"; range: UsageReportRange };
export function monitoringExportKey(
  actor: SenderIdentityActor,
  request: MonitoringExport | null,
  tenantId?: string,
) {
  return ["monitoringExport", actor.userId, actor.role, actor.tenantId, tenantId, request] as const;
}
export function monitoringExportFailureKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "monitoringExport.forbidden";
    if (error.statusCode === 400 || error.statusCode === 409) return "monitoringExport.narrow";
  }
  return "monitoringExport.error";
}
