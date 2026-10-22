import type {
  MessageHistoryItem,
  MessageHistoryQuery,
  PlatformMessageHistoryItem,
  SenderIdentityActor,
} from "./types";

export type MessageHistoryScope = "all-tenants" | "tenant";

export function messageHistoryScope(
  isPlatform: boolean,
  selectedTenantId?: string,
): MessageHistoryScope {
  return isPlatform && !selectedTenantId ? "all-tenants" : "tenant";
}

export function messageHistoryDetailTenantId(
  item: MessageHistoryItem | PlatformMessageHistoryItem,
): string | undefined {
  return "tenantId" in item ? item.tenantId : undefined;
}

export function tenantMessageHistoryQueryKey(
  query: MessageHistoryQuery | null,
  actor: SenderIdentityActor,
  tenantId?: string,
) {
  return ["messageHistory", actor.userId, actor.role, actor.tenantId, tenantId, query] as const;
}

export function allTenantMessageHistoryQueryKey(
  query: MessageHistoryQuery | null,
  actor: SenderIdentityActor,
) {
  return [
    "messageHistory",
    actor.userId,
    actor.role,
    actor.tenantId,
    "all-tenants",
    query,
  ] as const;
}

export function messageHistoryDetailQueryKey(
  id: string,
  actor: SenderIdentityActor,
  tenantId?: string,
) {
  return ["messageHistoryDetail", actor.userId, actor.role, actor.tenantId, tenantId, id] as const;
}
export function historyApplicationScope(
  actor: SenderIdentityActor,
  tenantId?: string,
  allTenants = false,
) {
  return JSON.stringify([
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin"
      ? allTenants
        ? "all-tenants"
        : (tenantId ?? null)
      : actor.tenantId,
  ]);
}
