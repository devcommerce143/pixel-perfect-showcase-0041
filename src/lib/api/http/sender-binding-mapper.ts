import type { SenderIdentityActor } from "../types.ts";
import type {
  StoredSenderBinding,
  SenderBindingQuery,
  SenderBindingPage,
  SenderBindingOperation,
  SenderBindingMutationResult,
} from "../sender-bindings.ts";
import { isTenantUuid } from "./tenant-mapper.ts";
function fail(): never {
  throw new Error("Invalid sender binding contract");
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function text(value: unknown, max = 320) {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : fail();
}
function uuid(value: unknown) {
  const id = text(value);
  return isTenantUuid(id) ? id : fail();
}
function instant(value: unknown) {
  const raw = text(value),
    date = new Date(raw);
  return Number.isFinite(date.getTime()) && date.toISOString() === raw ? raw : fail();
}
function authorize(actor: SenderIdentityActor) {
  if (actor.role !== "super_admin" || !actor.userId) fail();
}
export function senderBindingsPath(actor: SenderIdentityActor, query: SenderBindingQuery) {
  authorize(actor);
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) fail();
  const params = new URLSearchParams({
    tenantId: uuid(query.tenantId),
    limit: String(query.limit),
  });
  for (const field of ["providerAccountId", "senderIdentityId", "cursor"] as const)
    if (query[field] !== undefined) params.set(field, uuid(query[field]));
  return `/sender-provider-bindings?${params.toString()}`;
}
export function senderBindingPath(actor: SenderIdentityActor, id: string) {
  authorize(actor);
  return `/sender-provider-bindings/${uuid(id)}`;
}
export function mapSenderBinding(
  value: unknown,
  tenant: string,
  account?: string,
  id?: string,
): StoredSenderBinding {
  const row = object(value);
  if (
    row["tenantId"] !== uuid(tenant) ||
    (account && row["providerAccountId"] !== uuid(account)) ||
    (id && row["id"] !== uuid(id))
  )
    fail();
  return {
    id: uuid(row["id"]),
    tenantId: tenant,
    providerAccountId: uuid(row["providerAccountId"]),
    senderIdentityId: uuid(row["senderIdentityId"]),
    providerSenderName: text(row["providerSenderName"]),
    createdAt: instant(row["createdAt"]),
    updatedAt: instant(row["updatedAt"]),
  };
}
export function mapSenderBindingPage(value: unknown, query: SenderBindingQuery): SenderBindingPage {
  const row = object(value);
  if (!Array.isArray(row["items"])) fail();
  const items = row["items"].map((value) =>
    mapSenderBinding(value, query.tenantId, query.providerAccountId),
  );
  const nextCursor = row["nextCursor"] === null ? null : uuid(row["nextCursor"]);
  if (
    items.length > query.limit ||
    new Set(items.map((row) => row.id)).size !== items.length ||
    (query.senderIdentityId &&
      items.some((row) => row.senderIdentityId !== query.senderIdentityId)) ||
    (nextCursor !== null &&
      (items.length !== query.limit ||
        nextCursor !== items[items.length - 1]?.id ||
        nextCursor === query.cursor))
  )
    fail();
  return { items, nextCursor };
}
export function senderBindingMutationRequest(
  actor: SenderIdentityActor,
  operation: SenderBindingOperation,
) {
  authorize(actor);
  uuid(operation.tenantId);
  uuid(operation.providerAccountId);
  if (operation.kind === "remove")
    return { path: `${senderBindingPath(actor, operation.id)}/delete`, body: {} };
  const common = {
    tenantId: operation.tenantId,
    providerAccountId: operation.providerAccountId,
    senderIdentityId: uuid(operation.senderIdentityId),
  };
  if (operation.channel === "SMS") {
    const name = text(operation.providerSenderName, 64);
    if (name.trim() !== name) fail();
    return { path: "/sender-provider-bindings", body: { ...common, providerSenderName: name } };
  }
  if (operation.channel !== "EMAIL" && operation.channel !== "WHATSAPP") return fail();
  return {
    path: `/sender-provider-bindings/${operation.channel === "EMAIL" ? "email" : "whatsapp"}`,
    body: common,
  };
}
export function mapSenderBindingMutation(
  value: unknown,
  operation: SenderBindingOperation,
): SenderBindingMutationResult {
  if (operation.kind === "remove") {
    const row = object(value);
    if (row["id"] !== operation.id) fail();
    return { kind: "removed", id: uuid(row["id"]) };
  }
  const binding = mapSenderBinding(value, operation.tenantId, operation.providerAccountId);
  if (
    operation.channel === "EMAIL" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(binding.providerSenderName)
  )
    fail();
  if (operation.channel === "WHATSAPP" && !/^[0-9]{1,64}$/.test(binding.providerSenderName)) fail();
  if (
    binding.senderIdentityId !== operation.senderIdentityId ||
    (operation.channel === "SMS" && binding.providerSenderName !== operation.providerSenderName)
  )
    fail();
  return { kind: "created", binding };
}
