import type { Application, SenderIdentityActor, Channel } from "../types.ts";
import type { LiveApplicationMutation } from "../application-mutations.ts";
import { mapApplication } from "./application-mapper.ts";
const CHANNELS: Record<Channel, string> = { sms: "SMS", email: "EMAIL", whatsapp: "WHATSAPP" };
const SCOPES: Record<string, string> = {
  "messages:send": "MESSAGES_SEND",
  "messages:read": "MESSAGES_READ",
  "templates:read": "TEMPLATES_READ",
  "webhooks:manage": "WEBHOOKS_MANAGE",
};
function fail(): never {
  throw new Error("Invalid application mutation contract");
}
function uuid(value: unknown): string {
  return typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : fail();
}
function name(value: string) {
  const result = value.trim();
  return result.length > 0 && result.length <= 120 ? result : fail();
}
function list<T extends string>(values: readonly T[], choices: Record<string, string>): string[] {
  if (!Array.isArray(values) || new Set(values).size !== values.length) fail();
  return values.map((value) => (Object.hasOwn(choices, value) ? choices[value]! : fail()));
}
function senderAccess(mode: "all_eligible" | "allow_list", ids: string[]) {
  if (
    !["all_eligible", "allow_list"].includes(mode) ||
    !Array.isArray(ids) ||
    new Set(ids).size !== ids.length
  )
    fail();
  const allowListSenderIds = ids.map(uuid);
  if (mode === "all_eligible" && ids.length > 0) fail();
  return {
    senderAccess: mode === "all_eligible" ? "ALL_ELIGIBLE" : "ALLOW_LIST",
    allowListSenderIds,
  };
}
function status(value: Application["status"]) {
  return value === "active" ? "ACTIVE" : value === "disabled" ? "DISABLED" : fail();
}
function tenant(actor: SenderIdentityActor, tenantId?: string) {
  if (actor.role === "super_admin") return uuid(tenantId);
  const result = uuid(actor.tenantId);
  if (tenantId && tenantId !== result) fail();
  return result;
}
export function applicationMutationRequest(
  actor: SenderIdentityActor,
  operation: LiveApplicationMutation,
  tenantId?: string,
): { method: "post" | "patch" | "put"; path: string; body: unknown } {
  const target = tenant(actor, tenantId),
    base = `${actor.role === "super_admin" ? `/tenants/${target}` : ""}/applications`;
  if (operation.kind === "create") {
    const input = operation.input;
    if (!["production", "sandbox"].includes(input.environment)) fail();
    return {
      method: "post",
      path: base,
      body: {
        name: name(input.name),
        environment: input.environment === "production" ? "PRODUCTION" : "SANDBOX",
        status: status(input.status),
        channels: list(input.channels, CHANNELS),
        scopes: list(input.scopes, SCOPES),
        ...senderAccess(input.senderAccess, input.allowListSenderIds),
      },
    };
  }
  const path = `${base}/${uuid(operation.id)}`;
  switch (operation.kind) {
    case "name":
      return { method: "patch", path, body: { name: name(operation.name) } };
    case "status":
      return { method: "post", path: `${path}/status`, body: { status: status(operation.status) } };
    case "channels":
      return {
        method: "put",
        path: `${path}/channels`,
        body: { channels: list(operation.channels, CHANNELS) },
      };
    case "scopes":
      return {
        method: "put",
        path: `${path}/scopes`,
        body: { scopes: list(operation.scopes, SCOPES) },
      };
    case "sender-access":
      return {
        method: "put",
        path: `${path}/sender-access`,
        body: senderAccess(operation.senderAccess, operation.allowListSenderIds),
      };
    default:
      return fail();
  }
}
export function mapMutatedApplication(
  value: unknown,
  actor: SenderIdentityActor,
  operation: LiveApplicationMutation,
  tenantId?: string,
): Application {
  const saved = mapApplication(value);
  uuid(saved.id);
  if (
    saved.tenantId !== tenant(actor, tenantId) ||
    (operation.kind !== "create" && saved.id !== uuid(operation.id))
  )
    fail();
  for (const id of saved.allowListSenderIds ?? []) uuid(id);
  return saved;
}
