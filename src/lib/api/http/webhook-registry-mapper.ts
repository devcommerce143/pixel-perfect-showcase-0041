import type { SenderIdentityActor } from "../types.ts";
import { WEBHOOK_EVENTS, WEBHOOK_DELIVERY_STATES } from "../webhook-registry.ts";
import type {
  RegisteredWebhook,
  RegisteredWebhookInput,
  WebhookRegistryOperation,
  WebhookRegistryMutationResult,
  WebhookAttempt,
  WebhookHistoryQuery,
  WebhookHistoryPage,
} from "../webhook-registry.ts";
function fail(): never {
  throw new Error("Invalid webhook registry contract");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function text(value: unknown, max = 256, min = 1): string {
  return typeof value === "string" && value.length >= min && value.length <= max ? value : fail();
}
function uuid(value: unknown) {
  const id = text(value);
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ? id : fail();
}
function integer(value: unknown, min = 0): number {
  return Number.isSafeInteger(value) && (value as number) >= min ? (value as number) : fail();
}
function instant(value: unknown) {
  const result = text(value),
    date = new Date(result);
  return Number.isFinite(date.getTime()) && date.toISOString() === result ? result : fail();
}
function choice<T extends string>(value: unknown, options: readonly T[]): T {
  return options.includes(value as T) ? (value as T) : fail();
}
export function webhookBasePath(
  actor: SenderIdentityActor,
  applicationId: string,
  tenantId?: string,
) {
  const tenant = actor.role === "super_admin" ? uuid(tenantId) : uuid(actor.tenantId);
  if (actor.role !== "super_admin" && tenantId && tenantId !== tenant) fail();
  return `${actor.role === "super_admin" ? `/tenants/${tenant}` : ""}/applications/${uuid(applicationId)}/webhooks`;
}
export function webhookItemPath(
  actor: SenderIdentityActor,
  applicationId: string,
  id: string,
  tenantId?: string,
) {
  return `${webhookBasePath(actor, applicationId, tenantId)}/${uuid(id)}`;
}
export function webhookHistoryQuery(query: WebhookHistoryQuery) {
  const page = integer(query.page, 1),
    pageSize = integer(query.pageSize, 1);
  if (pageSize > 100 || (page - 1) * pageSize > 2147483647) fail();
  return new URLSearchParams({ page: String(page), pageSize: String(pageSize) }).toString();
}
export function webhookUrl(value: unknown): string {
  const result = text(value, 2048, 12);
  let url: URL;
  try {
    url = new URL(result);
  } catch {
    return fail();
  }
  const host = url.hostname.replace(/\.+$/, "").toLowerCase();
  if (
    result !== result.trim() ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    !host.includes(".") ||
    host.includes(":") ||
    /^\d+(?:\.\d+){3}$/.test(host) ||
    ["metadata.google.internal", "metadata.google.com"].includes(host) ||
    [".localhost", ".local", ".internal", ".localdomain"].some((suffix) => host.endsWith(suffix)) ||
    !host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    fail();
  return result;
}
function subscriptions(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || new Set(value).size !== value.length) fail();
  return value.map((item) => choice(item, WEBHOOK_EVENTS));
}
function inputBody(input: RegisteredWebhookInput, creating: boolean) {
  const description =
    input.description == null || input.description.trim() === ""
      ? null
      : text(input.description.trim(), 120);
  return {
    url: webhookUrl(input.url),
    eventTypes: subscriptions(input.eventTypes),
    ...(description !== null ? { description } : creating ? {} : { description: null }),
  };
}
export function webhookMutationRequest(
  actor: SenderIdentityActor,
  applicationId: string,
  operation: WebhookRegistryOperation,
  tenantId?: string,
): { method: "post" | "patch" | "delete"; path: string; body: unknown } {
  if (operation.kind === "create")
    return {
      method: "post",
      path: webhookBasePath(actor, applicationId, tenantId),
      body: inputBody(operation.input, true),
    };
  const path = webhookItemPath(actor, applicationId, operation.id, tenantId);
  if (operation.kind === "update")
    return { method: "patch", path, body: inputBody(operation.input, false) };
  if (operation.kind === "delete") return { method: "delete", path, body: undefined };
  const action =
    operation.kind === "rotate" ? "secret" : choice(operation.kind, ["enable", "disable", "ping"]);
  return { method: "post", path: `${path}/${action}`, body: {} };
}
export function mapRegisteredWebhook(
  value: unknown,
  applicationId: string,
  expectedId?: string,
): RegisteredWebhook {
  const row = record(value),
    id = uuid(row["id"]);
  if (
    row["applicationId"] !== uuid(applicationId) ||
    (expectedId && id !== uuid(expectedId)) ||
    typeof row["hasPreviousSecret"] !== "boolean"
  )
    fail();
  return {
    id,
    applicationId,
    url: webhookUrl(row["url"]),
    description: row["description"] === null ? null : text(row["description"], 120, 0),
    status: choice(row["status"], ["ACTIVE", "DISABLED"]),
    eventTypes: subscriptions(row["eventTypes"]),
    secretVersion: integer(row["secretVersion"], 1),
    hasPreviousSecret: row["hasPreviousSecret"],
    createdAt: instant(row["createdAt"]),
    updatedAt: instant(row["updatedAt"]),
  };
}
export function mapRegisteredWebhooks(value: unknown, applicationId: string) {
  if (!Array.isArray(value)) fail();
  const items = value.map((row) => mapRegisteredWebhook(row, applicationId));
  if (new Set(items.map((item) => item.id)).size !== items.length) fail();
  return items;
}
export function mapWebhookMutation(
  value: unknown,
  applicationId: string,
  operation: WebhookRegistryOperation,
): WebhookRegistryMutationResult {
  const row = record(value);
  if (operation.kind === "ping") return { kind: "queued", eventId: uuid(row["eventId"]) };
  if (operation.kind === "delete") {
    if (row["id"] !== operation.id) fail();
    return { kind: "deleted", id: uuid(row["id"]) };
  }
  const endpoint = mapRegisteredWebhook(
    row,
    applicationId,
    operation.kind === "create" ? undefined : operation.id,
  );
  if (
    ((operation.kind === "enable" || operation.kind === "create") &&
      endpoint.status !== "ACTIVE") ||
    (operation.kind === "disable" && endpoint.status !== "DISABLED")
  )
    fail();
  if (operation.kind === "create" || operation.kind === "rotate")
    return { kind: "secret", endpoint, secret: text(row["secret"], 4096) };
  return { kind: "endpoint", endpoint };
}
function safeError(value: unknown) {
  return typeof value === "string" &&
    (["tenant", "endpoint", "url", "ssrf", "event", "secret", "network"].includes(value) ||
      /^http:[1-5][0-9]{2}$/.test(value))
    ? value
    : null;
}
export function mapWebhookHistory(value: unknown, query: WebhookHistoryQuery): WebhookHistoryPage {
  webhookHistoryQuery(query);
  const row = record(value),
    total = integer(row["total"]);
  if (
    row["page"] !== query.page ||
    row["pageSize"] !== query.pageSize ||
    !Array.isArray(row["items"])
  )
    fail();
  const items: WebhookAttempt[] = row["items"].map((value) => {
    const item = record(value),
      lastHttpStatus =
        item["lastHttpStatus"] === null ? null : integer(item["lastHttpStatus"], 100);
    if (lastHttpStatus !== null && lastHttpStatus > 599) fail();
    return {
      id: uuid(item["id"]),
      eventId: uuid(item["eventId"]),
      eventType: choice(item["eventType"], [...WEBHOOK_EVENTS, "endpoint.ping"]),
      state: choice(item["state"], WEBHOOK_DELIVERY_STATES),
      attemptCount: integer(item["attemptCount"]),
      lastHttpStatus,
      lastErrorCategory: safeError(item["lastErrorCategory"]),
      nextAttemptAt: instant(item["nextAttemptAt"]),
      createdAt: instant(item["createdAt"]),
      finishedAt: item["finishedAt"] === null ? null : instant(item["finishedAt"]),
    };
  });
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.length !==
      Math.min(query.pageSize, Math.max(0, total - (query.page - 1) * query.pageSize))
  )
    fail();
  return { items, total, page: query.page, pageSize: query.pageSize };
}
