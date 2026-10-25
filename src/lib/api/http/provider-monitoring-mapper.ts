import type { SenderIdentityActor } from "../types.ts";
import {
  PROVIDER_HEALTH_STATES,
  PROVIDER_FAILURE_CLASSES,
  PROVIDER_TRANSPORTS,
} from "../provider-monitoring.ts";
import type {
  ProviderMonitorQuery,
  ProviderHealthRecord,
  ProviderRecordedCheck,
  ProviderAccountMetadata,
  ProviderCursorPage,
  ProviderBalanceObservation,
} from "../provider-monitoring.ts";
function fail(): never {
  throw new Error("Invalid provider monitoring contract");
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function text(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : fail();
}
function uuid(value: unknown) {
  const result = text(value);
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result) ? result : fail();
}
function count(value: unknown, min = 0): number {
  return Number.isSafeInteger(value) && (value as number) >= min ? (value as number) : fail();
}
function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? (value as T) : fail();
}
function instant(value: unknown) {
  const result = text(value),
    date = new Date(result);
  return Number.isFinite(date.getTime()) && date.toISOString() === result ? result : fail();
}
function nullable<T>(value: unknown, map: (input: unknown) => T): T | null {
  return value === null ? null : map(value);
}
function boolean(value: unknown) {
  return typeof value === "boolean" ? value : fail();
}
function httpStatus(value: unknown) {
  const status = count(value, 100);
  return status <= 599 ? status : fail();
}
function authorize(actor: SenderIdentityActor) {
  if (actor.role !== "super_admin" || !actor.userId) fail();
}
function transport(row: Record<string, unknown>) {
  if (row["transport"] === undefined) return {};
  const value = choice(row["transport"], PROVIDER_TRANSPORTS);
  const expected =
    value === "TAQNYAT_SMS"
      ? "SMS"
      : value === "TURBO_SMTP" || value === "TAQNYAT_EMAIL"
        ? "EMAIL"
        : "WHATSAPP";
  if (row["channel"] !== expected) fail();
  return { transport: value };
}
export function smsPilotControlPath(actor: SenderIdentityActor) {
  authorize(actor);
  return "/sms-pilot-controls";
}
export function mapSmsPilotControl(value: unknown) {
  return { submissionsEnabled: boolean(object(value)["submissionsEnabled"]) };
}
export function providerMonitorPath(actor: SenderIdentityActor, query: ProviderMonitorQuery) {
  authorize(actor);
  return `/provider-health?${providerMonitorQuery(query)}`;
}
export function providerMonitorQuery(query: ProviderMonitorQuery, checks = false) {
  const limit = count(query.limit, 1);
  if (limit > 100 || (checks && query.channel)) fail();
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.cursor !== undefined) params.set("cursor", uuid(query.cursor));
  if (query.channel !== undefined)
    params.set("channel", choice(query.channel, ["SMS", "EMAIL", "WHATSAPP"]));
  return params.toString();
}
export function providerMetadataPath(actor: SenderIdentityActor, id: string) {
  authorize(actor);
  return `/provider-accounts/${uuid(id)}`;
}
export function providerChecksPath(
  actor: SenderIdentityActor,
  id: string,
  query: ProviderMonitorQuery,
) {
  return `${providerMetadataPath(actor, id)}/health-checks?${providerMonitorQuery(query, true)}`;
}
export function mapProviderHealth(value: unknown): ProviderHealthRecord {
  const row = object(value);
  return {
    balanceObservation:
      row["balanceObservation"] == null
        ? null
        : mapProviderBalance(row["balanceObservation"], row["transport"]),
    providerAccountId: uuid(row["providerAccountId"]),
    code: text(row["code"]),
    channel: choice(row["channel"], ["SMS", "EMAIL", "WHATSAPP"]),
    ...transport(row),
    accountStatus: choice(row["accountStatus"], ["ACTIVE", "RETIRED"]),
    state: choice(row["state"], PROVIDER_HEALTH_STATES),
    consecutiveSuccesses: count(row["consecutiveSuccesses"]),
    consecutiveFailures: count(row["consecutiveFailures"]),
    lastCheckedAt: nullable(row["lastCheckedAt"], instant),
    lastTransitionAt: nullable(row["lastTransitionAt"], instant),
    lastHttpStatus: nullable(row["lastHttpStatus"], httpStatus),
    lastLatencyMs: nullable(row["lastLatencyMs"], count),
    lastFailureClass: nullable(row["lastFailureClass"], (value) =>
      choice(value, PROVIDER_FAILURE_CLASSES),
    ),
  };
}
export function mapProviderBalance(value: unknown, transport: unknown): ProviderBalanceObservation {
  choice(transport, PROVIDER_TRANSPORTS);
  const row = object(value);
  const status = choice(row["status"], [
    "NOT_RETRIEVED",
    "UNSUPPORTED",
    "SUCCESS",
    "FAILED",
  ] as const);
  const amount = nullable(row["amount"], text),
    unit = nullable(row["unit"], text);
  const lastAttemptAt = nullable(row["lastAttemptAt"], instant),
    lastSuccessAt = nullable(row["lastSuccessAt"], instant);
  const failureClass = nullable(row["failureClass"], (value) =>
    choice(value, PROVIDER_FAILURE_CLASSES),
  );
  const staleAfterMs = count(row["staleAfterMs"], 300_000);
  const hasValue = amount !== null && unit !== null && lastSuccessAt !== null;
  if (amount !== null && !/^(0|[1-9][0-9]{0,19})(\.[0-9]{1,8})?(?![\s\S])/.test(amount)) fail();
  if (unit !== null && !/^[A-Za-z][A-Za-z0-9_-]{0,7}(?![\s\S])/.test(unit)) fail();
  if (!hasValue && (amount !== null || unit !== null || lastSuccessAt !== null)) fail();
  if (lastSuccessAt && !lastAttemptAt) fail();
  if (
    status === "SUCCESS" &&
    (!hasValue || lastSuccessAt !== lastAttemptAt || failureClass !== null)
  )
    fail();
  if (status === "FAILED" && (!lastAttemptAt || !failureClass)) fail();
  if (
    (status === "NOT_RETRIEVED" || status === "UNSUPPORTED") &&
    (hasValue || lastAttemptAt || failureClass)
  )
    fail();
  if ((status === "UNSUPPORTED") !== (transport !== "TAQNYAT_SMS")) fail();
  return { status, amount, unit, lastAttemptAt, lastSuccessAt, failureClass, staleAfterMs };
}
export function mapProviderMetadata(value: unknown, id: string): ProviderAccountMetadata {
  const row = object(value);
  if (row["id"] !== uuid(id)) fail();
  return {
    id,
    code: text(row["code"]),
    channel: choice(row["channel"], ["SMS", "EMAIL", "WHATSAPP"]),
    ...transport(row),
    status: choice(row["status"], ["ACTIVE", "RETIRED"]),
    keyVersion: count(row["keyVersion"], 1),
  };
}
export function mapProviderChecks(value: unknown, id: string, query: ProviderMonitorQuery) {
  return cursorPage(
    value,
    query,
    (item) => {
      const row = object(item);
      if (row["providerAccountId"] !== uuid(id)) fail();
      const result: ProviderRecordedCheck = {
        id: uuid(row["id"]),
        providerAccountId: id,
        startedAt: instant(row["startedAt"]),
        finishedAt: instant(row["finishedAt"]),
        applied: boolean(row["applied"]),
        succeeded: boolean(row["succeeded"]),
        httpStatus: nullable(row["httpStatus"], httpStatus),
        latencyMs: nullable(row["latencyMs"], count),
        failureClass: nullable(row["failureClass"], (value) =>
          choice(value, PROVIDER_FAILURE_CLASSES),
        ),
        stateBefore: choice(row["stateBefore"], PROVIDER_HEALTH_STATES),
        stateAfter: choice(row["stateAfter"], PROVIDER_HEALTH_STATES),
      };
      if (result.finishedAt < result.startedAt) fail();
      return result;
    },
    (row) => row.id,
  );
}
export function mapProviderHealthPage(value: unknown, query: ProviderMonitorQuery) {
  return cursorPage(value, query, mapProviderHealth, (row) => row.providerAccountId);
}
function cursorPage<T>(
  value: unknown,
  query: ProviderMonitorQuery,
  map: (row: unknown) => T,
  id: (row: T) => string,
): ProviderCursorPage<T> {
  providerMonitorQuery(query);
  const row = object(value);
  if (!Array.isArray(row["items"])) fail();
  const items = row["items"].map(map),
    nextCursor = nullable(row["nextCursor"], uuid);
  if (
    items.length > query.limit ||
    new Set(items.map(id)).size !== items.length ||
    (nextCursor !== null &&
      (items.length !== query.limit ||
        nextCursor !== id(items[items.length - 1]!) ||
        nextCursor === query.cursor))
  )
    fail();
  return { items, nextCursor };
}
