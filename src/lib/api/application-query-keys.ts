import type { ApplicationListQuery, SenderIdentityActor } from "./types";

export function applicationPageQueryKey(
  actor: SenderIdentityActor,
  query: ApplicationListQuery,
  tenantId?: string,
) {
  return [
    "applicationsPage",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? ["platform-tenant", tenantId ?? null] : ["tenant"],
    query,
  ] as const;
}

export function allTenantApplicationPageQueryKey(
  actor: SenderIdentityActor,
  query: ApplicationListQuery,
) {
  return [
    "applicationsPage",
    actor.userId,
    actor.role,
    actor.tenantId,
    ["all-tenants"],
    query,
  ] as const;
}

export function applicationDetailQueryKey(
  actor: SenderIdentityActor,
  id: string,
  tenantId?: string,
) {
  return [
    "application",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? ["platform-tenant", tenantId ?? null] : ["tenant"],
    id,
  ] as const;
}

export function applicationReadQueryOptions<TData>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  enabled: boolean,
) {
  return {
    queryKey,
    queryFn,
    enabled,
    retry: false as const,
  };
}
