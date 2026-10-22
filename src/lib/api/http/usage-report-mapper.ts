import type { SenderIdentityActor } from "../types.ts";
import type { LiveUsageReport, UsageReportRange } from "../usage-report.ts";

const STATUSES = [
  "ACCEPTED",
  "QUEUED",
  "DISPATCHING",
  "SUBMITTED",
  "FAILED",
  "UNKNOWN",
  "DELIVERED",
  "READ",
] as const;
const CHANNELS = ["SMS", "EMAIL", "WHATSAPP"] as const;
function fail(): never {
  throw new Error("Invalid usage report contract");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function array(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : fail();
}
function count(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : fail();
}
function text(value: unknown): string {
  return typeof value === "string" ? value : fail();
}
function uuid(value: unknown): string {
  const id = text(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : fail();
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? (value as T) : fail();
}
function instant(value: unknown): string {
  const raw = text(value),
    date = new Date(raw),
    canonical = raw.includes(".") ? raw : raw.replace("Z", ".000Z");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString() === canonical
    ? raw
    : fail();
}
export function usageRangeQuery(range: UsageReportRange): string {
  const from = instant(range.acceptedFrom),
    to = instant(range.acceptedTo),
    span = Date.parse(to) - Date.parse(from);
  if (span <= 0 || span > 31 * 86400000) fail();
  return new URLSearchParams({ acceptedFrom: from, acceptedTo: to }).toString();
}
export function usageReportPath(
  actor: SenderIdentityActor,
  range: UsageReportRange,
  tenantId?: string,
) {
  if (actor.role === "super_admin") {
    if (!tenantId) throw new Error("A named tenant is required");
    return `/tenants/${uuid(tenantId)}/usage?${usageRangeQuery(range)}`;
  }
  uuid(actor.tenantId);
  if (tenantId && tenantId !== actor.tenantId) fail();
  return `/usage?${usageRangeQuery(range)}`;
}
export function mapUsageReport(value: unknown, requestedRange: UsageReportRange): LiveUsageReport {
  const row = record(value),
    messageCounts = record(row["messageCounts"]);
  const acceptedFrom = instant(row["acceptedFrom"]),
    acceptedTo = instant(row["acceptedTo"]);
  if (
    Date.parse(acceptedFrom) !== Date.parse(requestedRange.acceptedFrom) ||
    Date.parse(acceptedTo) !== Date.parse(requestedRange.acceptedTo)
  )
    fail();
  usageRangeQuery({ acceptedFrom, acceptedTo });
  const byStatus = array(messageCounts["byStatus"]).map((row) => ({
    status: enumValue(
      row["status"],
      STATUSES,
    ).toLowerCase() as LiveUsageReport["messageCounts"]["byStatus"][number]["status"],
    count: count(row["count"]),
  }));
  const byChannel = array(messageCounts["byChannel"]).map((row) => ({
    channel: enumValue(
      row["channel"],
      CHANNELS,
    ).toLowerCase() as LiveUsageReport["messageCounts"]["byChannel"][number]["channel"],
    count: count(row["count"]),
  }));
  const byApplication = array(messageCounts["byApplication"]).map((row) => ({
    applicationId: uuid(row["applicationId"]),
    channel: enumValue(
      row["channel"],
      CHANNELS,
    ).toLowerCase() as LiveUsageReport["messageCounts"]["byApplication"][number]["channel"],
    status: enumValue(
      row["status"],
      STATUSES,
    ).toLowerCase() as LiveUsageReport["messageCounts"]["byApplication"][number]["status"],
    count: count(row["count"]),
  }));
  const quota = array(row["quota"]).map((row) => {
    const periodStart = text(row["periodStart"]);
    if (
      !/^\d{4}-\d{2}-01$/.test(periodStart) ||
      !Number.isFinite(Date.parse(periodStart)) ||
      new Date(periodStart).toISOString().slice(0, 10) !== periodStart
    )
      fail();
    const start = Date.parse(periodStart),
      next = new Date(start);
    next.setUTCMonth(next.getUTCMonth() + 1);
    if (start >= Date.parse(acceptedTo) || next.getTime() <= Date.parse(acceptedFrom)) fail();
    return {
      periodStart,
      counterScope: enumValue(row["counterScope"], ["AGGREGATE", ...CHANNELS] as const),
      reservedCount: count(row["reservedCount"]),
      committedCount: count(row["committedCount"]),
    };
  });
  if (
    new Set(byStatus.map((row) => row.status)).size !== byStatus.length ||
    new Set(byChannel.map((row) => row.channel)).size !== byChannel.length ||
    new Set(byApplication.map((row) => `${row.applicationId}:${row.channel}:${row.status}`))
      .size !== byApplication.length ||
    new Set(quota.map((row) => `${row.periodStart}:${row.counterScope}`)).size !== quota.length
  )
    fail();
  return { acceptedFrom, acceptedTo, messageCounts: { byStatus, byChannel, byApplication }, quota };
}
