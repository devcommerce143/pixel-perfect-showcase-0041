import type { SenderIdentityActor } from "./types.ts";

export type NamedEntity = "tenant" | "application" | "sender" | "provider" | "template" | "route";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function humanName(value: string | null | undefined): string | null {
  const name = value?.trim();
  return name && !UUID.test(name) ? name : null;
}

export function entityNameKey(
  actor: SenderIdentityActor,
  kind: NamedEntity,
  id: string,
  tenantId?: string,
) {
  return [
    "entityName",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? "platform" : "tenant",
    tenantId ?? null,
    kind,
    id,
  ] as const;
}

export function canResolveEntity(
  actor: SenderIdentityActor,
  kind: NamedEntity,
  id: string,
  tenantId?: string,
) {
  if (!actor.userId || !id) return false;
  if (kind === "tenant" || kind === "provider" || kind === "route")
    return actor.role === "super_admin";
  if (actor.role === "super_admin") return !!tenantId;
  return !!actor.tenantId && (!tenantId || tenantId === actor.tenantId);
}
