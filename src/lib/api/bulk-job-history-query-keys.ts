import type { SenderIdentityActor } from "./types.ts";
import type { BulkHistoryQuery, BulkHistoryItemsQuery } from "./bulk-job-history-types.ts";

export function bulkHistoryKey(
  actor: SenderIdentityActor,
  scope: "tenant" | "all-tenants",
  tenantId?: string,
) {
  return ["bulkJobHistory", actor.userId, actor.role, actor.tenantId, scope, tenantId] as const;
}
export function bulkHistoryListKey(
  actor: SenderIdentityActor,
  query: BulkHistoryQuery | null,
  scope: "tenant" | "all-tenants",
  tenantId?: string,
) {
  return [...bulkHistoryKey(actor, scope, tenantId), "list", query] as const;
}
export function bulkHistoryDetailKey(actor: SenderIdentityActor, id: string, tenantId?: string) {
  return [...bulkHistoryKey(actor, "tenant", tenantId), "detail", id] as const;
}
export function bulkHistoryItemsKey(
  actor: SenderIdentityActor,
  id: string,
  query: BulkHistoryItemsQuery,
  tenantId?: string,
) {
  return [...bulkHistoryKey(actor, "tenant", tenantId), "items", id, query] as const;
}
