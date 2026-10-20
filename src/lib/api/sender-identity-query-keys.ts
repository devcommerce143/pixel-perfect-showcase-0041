import type { SenderIdentityActor, SenderIdentityListQuery, Role } from "./types.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";

export function senderIdentityScopeKey(
  actor: SenderIdentityActor,
  tenantId?: string,
  allTenants = false,
): string {
  return JSON.stringify([
    actor.userId,
    actor.role,
    actor.tenantId,
    allTenants ? "all-tenants" : (tenantId ?? null),
  ]);
}

export function senderIdentitySelectionMatchesScope(
  selectionScope: string | undefined,
  currentScope: string,
): boolean {
  return selectionScope === currentScope;
}

export function senderIdentityPageQueryKey(
  actor: SenderIdentityActor,
  query: SenderIdentityListQuery,
  tenantId?: string,
) {
  return [
    "senderIdentityReadPage",
    actor.userId,
    actor.role,
    actor.tenantId,
    tenantId ?? "token-tenant",
    {
      page: query.page,
      pageSize: query.pageSize,
      channel: query.filters?.channel ?? "all",
      verificationStatus: query.filters?.verificationStatus ?? "all",
      operationalStatus: query.filters?.operationalStatus ?? "all",
    },
  ] as const;
}

export function senderIdentityDetailQueryKey(
  actor: SenderIdentityActor,
  id: string,
  tenantId?: string,
) {
  return [
    "senderIdentityRead",
    actor.userId,
    actor.role,
    actor.tenantId,
    tenantId ?? "token-tenant",
    id,
  ] as const;
}

export function allTenantSenderIdentityPageQueryKey(
  actor: SenderIdentityActor,
  query: SenderIdentityListQuery,
) {
  return [
    "senderIdentityReadPage",
    actor.userId,
    actor.role,
    actor.tenantId,
    "all-tenants",
    {
      page: query.page,
      pageSize: query.pageSize,
      channel: query.filters?.channel ?? "all",
      verificationStatus: query.filters?.verificationStatus ?? "all",
      operationalStatus: query.filters?.operationalStatus ?? "all",
      tenantId: query.filters?.tenantId ?? null,
    },
  ] as const;
}

export function senderIdentityDetailTenantId(
  isPlatform: boolean,
  selectedTenantId: string | undefined,
  rowTenantId: string | undefined,
  allTenants = false,
): string | undefined {
  if (!isPlatform) return undefined;
  if (allTenants) return rowTenantId;
  return selectedTenantId && rowTenantId === selectedTenantId ? rowTenantId : undefined;
}

export function senderIdentityUsesReadOnlyView(mode: "live" | "mock"): boolean {
  return mode === "live";
}

export function senderIdentityScopeIsAvailable(role: Role, tenantId?: string): boolean {
  return role !== "super_admin" || isTenantUuid(tenantId ?? "");
}
