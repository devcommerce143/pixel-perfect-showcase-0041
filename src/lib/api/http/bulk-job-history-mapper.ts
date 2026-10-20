import {
  BULK_HISTORY_RESULTS,
  BULK_HISTORY_STATUSES,
  BULK_HISTORY_STATES,
} from "../bulk-job-history-types.ts";
import type {
  BulkHistoryJob,
  BulkHistoryItem,
  BulkHistoryPage,
  BulkHistoryQuery,
  BulkHistoryItemsQuery,
} from "../bulk-job-history-types.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function bulkHistoryUuid(value: string) {
  if (!UUID.test(value)) throw new Error("Invalid bulk history identifier");
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid bulk history response");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid bulk history string");
  return value;
}
function number(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error("Invalid bulk history count");
  return value as number;
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new Error("Invalid bulk history status");
  return value as T;
}
function instant(value: unknown): string {
  const text = string(value);
  const canonical = text.includes(".") ? text : text.replace("Z", ".000Z");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text) ||
    !Number.isFinite(Date.parse(text)) ||
    new Date(text).toISOString() !== canonical
  )
    throw new Error("Invalid bulk history timestamp");
  return text;
}
export function mapBulkHistoryJob(
  value: unknown,
  platform = false,
  detail = false,
): BulkHistoryJob {
  const row = record(value);
  const job: BulkHistoryJob = {
    id: bulkHistoryUuid(string(row["id"])),
    tenantId: bulkHistoryUuid(string(row["tenantId"])),
    applicationId: bulkHistoryUuid(string(row["applicationId"])),
    applicationName: string(row["applicationName"]),
    channel: enumValue(row["channel"], [
      "SMS",
      "EMAIL",
      "WHATSAPP",
    ]).toLowerCase() as BulkHistoryJob["channel"],
    mode: enumValue(row["mode"], ["SHARED", "PERSONALIZED"]),
    status: enumValue(
      row["status"],
      BULK_HISTORY_STATUSES.map((s) => s.toUpperCase()),
    ).toLowerCase() as BulkHistoryJob["status"],
    result: enumValue(row["result"], BULK_HISTORY_RESULTS),
    itemCount: number(row["itemCount"]),
    invalidCount: number(row["invalidCount"]),
    pendingCount: number(row["pendingCount"]),
    acceptedCount: number(row["acceptedCount"]),
    skippedCount: number(row["skippedCount"]),
    failedCount: number(row["failedCount"]),
    createdAt: instant(row["createdAt"]),
  };
  if (platform) job.tenantName = string(row["tenantName"]);
  if (detail) {
    job.completedAt = row["completedAt"] === null ? null : instant(row["completedAt"]);
    job.cancelledAt = row["cancelledAt"] === null ? null : instant(row["cancelledAt"]);
  }
  return job;
}
const SAFE_CODES = new Set([
  "RECIPIENT",
  "CONTENT",
  "OVERRIDE",
  "TEMPLATE",
  "ENTITLEMENT",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "REJECTED",
  "ATTEMPT_LIMIT",
]);
export function mapBulkHistoryItem(value: unknown): BulkHistoryItem {
  const row = record(value);
  const rowNumber = number(row["rowNumber"]);
  if (!rowNumber) throw new Error("Invalid bulk row number");
  return {
    rowNumber,
    state: enumValue(
      row["state"],
      BULK_HISTORY_STATES.map((s) => s.toUpperCase()),
    ).toLowerCase() as BulkHistoryItem["state"],
    errorCode:
      typeof row["errorCode"] === "string" && SAFE_CODES.has(row["errorCode"])
        ? row["errorCode"]
        : null,
    messageId: row["messageId"] === null ? null : bulkHistoryUuid(string(row["messageId"])),
  };
}
export function mapBulkHistoryPage<T>(
  value: unknown,
  map: (row: unknown) => T,
): BulkHistoryPage<T> {
  const row = record(value);
  const page = number(row["page"]),
    pageSize = number(row["pageSize"]),
    total = number(row["total"]);
  if (
    page < 1 ||
    pageSize < 1 ||
    pageSize > 100 ||
    !Array.isArray(row["items"]) ||
    row["items"].length > pageSize
  )
    throw new Error("Invalid bulk history page");
  return { page, pageSize, total, items: row["items"].map(map) };
}
export function bulkHistoryPath(role: string, tenantId?: string, allTenants = false): string {
  if (allTenants) {
    if (role !== "super_admin") throw new Error("Platform context required");
    return "/platform/bulk-job-history";
  }
  if (role === "super_admin") {
    if (!tenantId) throw new Error("Target tenant required");
    return `/tenants/${bulkHistoryUuid(tenantId)}/bulk-job-history`;
  }
  return "/bulk-job-history";
}
export function bulkHistoryQueryString(query: BulkHistoryQuery | BulkHistoryItemsQuery): string {
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    query.page > 2147483647 ||
    !Number.isInteger(query.pageSize) ||
    query.pageSize < 1 ||
    query.pageSize > 100
  )
    throw new Error("Invalid bulk history pagination");
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if ("createdFrom" in query) {
    const from = instant(query.createdFrom),
      to = instant(query.createdTo);
    const span = Date.parse(to) - Date.parse(from);
    if (span <= 0 || span > 31 * 86400000) throw new Error("Invalid bulk history range");
    params.set("createdFrom", from);
    params.set("createdTo", to);
    if (query.applicationId) params.set("applicationId", bulkHistoryUuid(query.applicationId));
    if (query.jobId) params.set("jobId", bulkHistoryUuid(query.jobId));
    if (query.channel)
      params.set("channel", enumValue(query.channel, ["sms", "email", "whatsapp"]).toUpperCase());
    if (query.status)
      params.set("status", enumValue(query.status, BULK_HISTORY_STATUSES).toUpperCase());
  } else if (query.state)
    params.set("state", enumValue(query.state, BULK_HISTORY_STATES).toUpperCase());
  return params.toString();
}
