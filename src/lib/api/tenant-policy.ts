import type { SenderIdentityActor } from "./types.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";

export function tenantPolicyScope(actor: SenderIdentityActor, tenantId?: string) {
  const target = actor.role === "super_admin" ? tenantId : actor.tenantId;
  if (
    !actor.userId ||
    !isTenantUuid(target ?? "") ||
    (actor.role !== "super_admin" && tenantId !== undefined && tenantId !== actor.tenantId)
  )
    throw new Error("Invalid tenant policy scope");
  return target as string;
}
export function tenantPolicyPath(actor: SenderIdentityActor, tenantId?: string) {
  const target = tenantPolicyScope(actor, tenantId);
  return actor.role === "super_admin" ? `/tenants/${target}/subscription` : "/subscription";
}
export function tenantPolicyKey(actor: SenderIdentityActor, tenantId?: string) {
  return [
    "tenantPolicy",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? tenantId : actor.tenantId,
  ] as const;
}
