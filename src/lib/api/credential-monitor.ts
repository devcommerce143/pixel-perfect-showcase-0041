import type { SenderIdentityActor, Paginated } from "./types.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";
export type MonitoredCredentialStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
export interface CredentialMonitorQuery {
  page: number;
  pageSize: number;
  tenantId?: string;
  applicationId?: string;
  status?: MonitoredCredentialStatus;
  search?: string;
}
export interface MonitoredCredential {
  id: string;
  tenantId: string;
  tenantName: string;
  applicationId: string;
  applicationName: string;
  clientId: string;
  status: MonitoredCredentialStatus;
  effectiveStatus: MonitoredCredentialStatus;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  rateLimitPerSecondOverride: number | null;
}
function fail(): never {
  throw new Error("Invalid credential monitoring contract");
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function text(value: unknown): string {
  return typeof value === "string" && value.length > 0 ? value : fail();
}
function uuid(value: unknown) {
  const result = text(value);
  return isTenantUuid(result) ? result : fail();
}
function count(value: unknown, minimum = 0): number {
  return Number.isSafeInteger(value) && (value as number) >= minimum ? (value as number) : fail();
}
function status(value: unknown): MonitoredCredentialStatus {
  return value === "ACTIVE" || value === "REVOKED" || value === "EXPIRED" ? value : fail();
}
function timestamp(value: unknown) {
  const result = text(value),
    date = new Date(result);
  return Number.isFinite(date.getTime()) && date.toISOString() === result ? result : fail();
}
function nullableTimestamp(value: unknown) {
  return value === null ? null : timestamp(value);
}
export function credentialMonitorKey(actor: SenderIdentityActor, query: CredentialMonitorQuery) {
  return [
    "credentialMonitor",
    actor.userId,
    actor.role,
    actor.tenantId,
    "platform",
    query,
  ] as const;
}
export function credentialMonitorPath(actor: SenderIdentityActor, query: CredentialMonitorQuery) {
  if (actor.role !== "super_admin" || !actor.userId) fail();
  const page = count(query.page, 1),
    pageSize = count(query.pageSize, 1);
  if (pageSize > 100 || (page - 1) * pageSize > 2147483647) fail();
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (query.tenantId !== undefined) params.set("tenantId", uuid(query.tenantId));
  if (query.applicationId !== undefined) params.set("applicationId", uuid(query.applicationId));
  if (query.status !== undefined) params.set("status", status(query.status));
  if (query.search !== undefined) {
    const search = query.search.trim();
    if (
      search.length > 100 ||
      Array.from(search).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
    )
      fail();
    if (search) params.set("search", search);
  }
  return `/platform/api-credentials?${params}`;
}
export function mapCredentialMonitorPage(
  value: unknown,
  query: CredentialMonitorQuery,
): Paginated<MonitoredCredential> {
  const body = object(value);
  if (
    body["page"] !== query.page ||
    body["pageSize"] !== query.pageSize ||
    !Array.isArray(body["items"])
  )
    fail();
  const items = (body["items"] as unknown[]).map((value): MonitoredCredential => {
    const row = object(value);
    const result = {
      id: uuid(row["id"]),
      tenantId: uuid(row["tenantId"]),
      tenantName: text(row["tenantName"]),
      applicationId: uuid(row["applicationId"]),
      applicationName: text(row["applicationName"]),
      clientId: text(row["clientId"]),
      status: status(row["status"]),
      effectiveStatus: status(row["effectiveStatus"]),
      createdAt: timestamp(row["createdAt"]),
      expiresAt: nullableTimestamp(row["expiresAt"]),
      lastUsedAt: nullableTimestamp(row["lastUsedAt"]),
      rateLimitPerSecondOverride:
        row["rateLimitPerSecondOverride"] === null
          ? null
          : count(row["rateLimitPerSecondOverride"], 1),
    };
    if (
      (query.tenantId && result.tenantId !== query.tenantId) ||
      (query.applicationId && result.applicationId !== query.applicationId) ||
      (query.status && result.effectiveStatus !== query.status) ||
      (result.status !== "ACTIVE" && result.status !== result.effectiveStatus)
    )
      fail();
    return result;
  });
  const total = count(body["total"]);
  if (
    items.length > query.pageSize ||
    items.length > total ||
    new Set(items.map((row) => row.id)).size !== items.length
  )
    fail();
  return { items, page: query.page, pageSize: query.pageSize, total };
}
