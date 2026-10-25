import type {
  AdministrativeAuditQuery,
  AdministrativeAuditEvent,
  AdministrativeAuditPage,
  AuditRetentionPolicy,
} from "../administrative-audit.ts";
import type { SenderIdentityActor } from "../types.ts";
import { usageRangeQuery } from "./usage-report-mapper.ts";
import { humanName } from "../entity-names.ts";

export const AUDIT_ACTIONS = [
  "application.create",
  "application.name.update",
  "application.status.change",
  "application.channels.replace",
  "application.scopes.replace",
  "application.sender-access.replace",
  "user.create",
  "user.profile.update",
  "user.status.change",
  "user.role.change",
  "user.external-subject.update",
  "sender.create",
  "sender.submit",
  "sender.review",
  "sender.verify",
  "sender.reject",
  "sender.reopen",
  "sender.activate",
  "sender.deactivate",
  "sender.suspend",
  "sender.email-evidence.record",
  "template.create",
  "template.ready",
  "template.retire",
  "template.evidence.record",
  "content-template.create",
  "content-template.ready",
  "content-template.retire",
  "provider.live-test.started",
  "provider.live-test.finished",
  "sender-binding.update",
  "webhook.create",
  "webhook.update",
  "webhook.enable",
  "webhook.disable",
  "webhook.secret.rotate",
  "webhook.delete",
  "webhook.ping",
  "credential.issue",
  "credential.rotate",
  "credential.revoke",
  "plan.create",
  "plan.details.update",
  "plan.commercial-terms.update",
  "plan.status.change",
  "plan.features.replace",
  "plan.channel-entitlement.set",
  "subscription.assign",
  "subscription.overrides.update",
  "subscription.channel-override.set",
  "subscription.channel-override.clear",
  "subscription.cancel",
  "provider-account.create",
  "provider-account.email-create",
  "provider-account.whatsapp-create",
  "provider-account.token-replace",
  "provider-account.email-credentials-replace",
  "provider-account.whatsapp-token-replace",
  "provider-account.meta-callback-secrets-set",
  "provider-account.meta-callback-app-secret-rotate",
  "provider-account.meta-callback-verify-token-rotate",
  "provider-account.reencrypt",
  "sender-binding.create",
  "sender-binding.email-create",
  "sender-binding.whatsapp-create",
  "sender-binding.delete",
  "sms-pilot-grant.create",
  "sms-pilot-grant.arm",
  "sms-pilot-grant.revoke",
  "sms-pilot-control.update",
  "dispatch.unknown.resolve",
  "provider-route.create",
  "provider-route.status",
  "provider-route.member-add",
  "provider-route.member-update",
  "provider-route.tenant-assign",
  "provider-route.sender-assign",
  "tenant.create",
  "tenant.profile.update",
  "tenant.status.change",
  "tenant.data-region.change",
  "tenant.primary-admin.assign",
  "sms-failover.decision",
  "audit.retention.update",
  "security.access.denied",
  "message.accept",
  "message.status",
  "bulk.create",
  "bulk.cancel",
  "bulk.status",
  "sms-pilot-grant.consume",
  "sms-pilot-grant.expire",
  "credential.expire",
  "quota.reserve",
  "quota.commit",
  "quota.release",
] as const;
const RESOURCES = [
  "tenant",
  "application",
  "user",
  "credential",
  "subscription",
  "plan",
  "sender",
  "sender-binding",
  "template",
  "webhook",
  "provider",
  "route",
  "route-member",
  "route-assignment",
  "message",
  "bulk-job",
  "audit-policy",
  "security",
  "pilot-grant",
  "pilot-control",
] as const;
const STATES = [
  "DRAFT",
  "READY",
  "RETIRED",
  "UNKNOWN",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "DISABLED",
  "ACTIVE",
  "SUSPENDED",
  "INVITED",
  "TRIAL",
  "INACTIVE",
  "ARCHIVED",
  "CANCELLED",
  "REVOKED",
  "SUBMITTED",
  "QUEUED",
  "FAILED",
  "DELIVERED",
  "READ",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "DELETED",
  "RECEIVED",
  "COMPLETED",
  "VALIDATING",
  "MATERIALIZING",
  "PROCESSING",
  "COMPLETED_WITH_FAILURES",
  "ARMED",
  "CONSUMED",
  "EXPIRED",
  "CLIENT_ADMIN",
  "OPERATOR",
  "VIEWER",
  "PLATFORM_SUPER_ADMIN",
];
function fail(): never {
  throw new Error("Invalid administrative audit contract");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function text(value: unknown): string {
  return typeof value === "string" ? value : fail();
}
function uuid(value: unknown): string {
  const id = text(value);
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ? id : fail();
}
function nullableUuid(value: unknown) {
  return value === null ? null : uuid(value);
}
function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? (value as T) : fail();
}
function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max
    ? (value as number)
    : fail();
}
function instant(value: unknown): string {
  const raw = text(value);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw) &&
    new Date(raw).toISOString() === raw
    ? raw
    : fail();
}
export function auditBasePath(actor: SenderIdentityActor, tenantId?: string): string {
  if (actor.role === "super_admin")
    return tenantId ? `/tenants/${uuid(tenantId)}/audit-events` : "/platform/audit-events";
  uuid(actor.tenantId);
  if (tenantId && tenantId !== actor.tenantId) fail();
  return "/audit-events";
}
export function auditDetailPath(actor: SenderIdentityActor, id: string, tenantId?: string): string {
  if (actor.role === "super_admin" && !tenantId) fail();
  return `${auditBasePath(actor, tenantId)}/${uuid(id)}`;
}
export function auditQueryString(query: AdministrativeAuditQuery): string {
  const params = new URLSearchParams(usageRangeQuery(query));
  params.set("page", String(integer(query.page, 1, 2147483647)));
  params.set("pageSize", String(integer(query.pageSize, 1, 100)));
  if ((query.page - 1) * query.pageSize > 2147483647) fail();
  if (query.action) params.set("action", choice(query.action, AUDIT_ACTIONS));
  if (query.outcome) params.set("outcome", choice(query.outcome, ["SUCCESS", "DENIED", "FAILURE"]));
  if (query.actorUserId) params.set("actorUserId", uuid(query.actorUserId));
  if (query.actorCredentialId) params.set("actorCredentialId", uuid(query.actorCredentialId));
  if (query.resourceId) params.set("resourceId", uuid(query.resourceId));
  return params.toString();
}
export function mapAdministrativeAudit(
  value: unknown,
  expectedTenant?: string,
): AdministrativeAuditEvent {
  const row = record(value),
    tenantId = nullableUuid(row["tenantId"]);
  if (expectedTenant && tenantId !== expectedTenant) fail();
  const actorKind = choice(row["actorKind"], ["HUMAN", "MACHINE", "SYSTEM"]),
    actorUserId = nullableUuid(row["actorUserId"]),
    actorCredentialId = nullableUuid(row["actorCredentialId"]);
  if (
    (actorKind === "HUMAN" && (!actorUserId || actorCredentialId !== null)) ||
    (actorKind === "MACHINE" && (actorUserId !== null || !actorCredentialId || !tenantId)) ||
    (actorKind === "SYSTEM" && (actorUserId !== null || actorCredentialId !== null))
  )
    fail();
  const source = record(row["details"]),
    details: AdministrativeAuditEvent["details"] = {};
  for (const key of ["previousState", "nextState", "previousRole", "nextRole"]) {
    if (typeof source[key] === "string" && STATES.includes(source[key])) details[key] = source[key];
  }
  for (const key of ["previousReservationState", "nextReservationState"]) {
    if (
      typeof source[key] === "string" &&
      ["RESERVED", "COMMITTED", "RELEASED"].includes(source[key])
    )
      details[key] = source[key];
  }
  for (const key of ["previousRetentionDays", "nextRetentionDays", "priority"]) {
    if (Number.isSafeInteger(source[key]) && (source[key] as number) >= 0)
      details[key] = source[key] as number;
  }
  for (const key of [
    "routeId",
    "providerAccountId",
    "nextProviderAccountId",
    "senderIdentityId",
    "messageId",
  ]) {
    if (
      typeof source[key] === "string" &&
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(source[key])
    )
      details[key] = source[key];
  }
  if (typeof source["enabled"] === "boolean") details["enabled"] = source["enabled"];
  for (const key of [
    "previousDomainState",
    "nextDomainState",
    "previousSpfState",
    "nextSpfState",
    "previousDkimState",
    "nextDkimState",
  ]) {
    if (
      typeof source[key] === "string" &&
      ["NOT_CONFIGURED", "PENDING", "VERIFIED", "FAILED"].includes(source[key])
    )
      details[key] = source[key];
  }
  if (source["evidenceSource"] === "OPERATOR_REVIEW")
    details["evidenceSource"] = source["evidenceSource"];
  if (
    typeof source["evidenceReference"] === "string" &&
    /^(ticket|change|review):[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(source["evidenceReference"])
  )
    details["evidenceReference"] = source["evidenceReference"];
  if (typeof source["continued"] === "boolean") details["continued"] = source["continued"];
  if (
    source["failoverReason"] === "insufficient_balance" ||
    source["failoverReason"] === "account_configuration"
  )
    details["failoverReason"] = source["failoverReason"];
  const correlationId = text(row["correlationId"]);
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(correlationId)) fail();
  return {
    id: uuid(row["id"]),
    tenantId,
    actorKind,
    actorUserId,
    actorName:
      actorKind === "HUMAN" &&
      typeof row["actorName"] === "string" &&
      row["actorName"].length <= 201
        ? humanName(row["actorName"])
        : null,
    actorCredentialId,
    action: choice(row["action"], AUDIT_ACTIONS),
    resourceType: choice(row["resourceType"], RESOURCES),
    resourceId: nullableUuid(row["resourceId"]),
    outcome: choice(row["outcome"], ["SUCCESS", "DENIED", "FAILURE"]),
    correlationId,
    details,
    createdAt: instant(row["createdAt"]),
  };
}
export function mapAdministrativeAuditPage(
  value: unknown,
  query: AdministrativeAuditQuery,
  expectedTenant?: string,
): AdministrativeAuditPage {
  const row = record(value);
  if (
    row["page"] !== query.page ||
    row["pageSize"] !== query.pageSize ||
    !Array.isArray(row["items"]) ||
    row["items"].length > query.pageSize
  )
    fail();
  const items = row["items"].map((item) => mapAdministrativeAudit(item, expectedTenant));
  if (new Set(items.map((item) => item.id)).size !== items.length) fail();
  const total = integer(row["total"], 0);
  if (
    items.length !==
    Math.min(query.pageSize, Math.max(0, total - (query.page - 1) * query.pageSize))
  )
    fail();
  return { items, total, page: query.page, pageSize: query.pageSize };
}
export function mapAuditRetention(value: unknown): AuditRetentionPolicy {
  const row = record(value);
  if (row["deletionEnabled"] !== false || row["complianceConfirmationPending"] !== true) fail();
  return {
    retentionDays: integer(row["retentionDays"], 1, 2147483647),
    updatedAt: instant(row["updatedAt"]),
    deletionEnabled: false,
    complianceConfirmationPending: true,
  };
}
export function auditRetentionRequest(actor: SenderIdentityActor, days: number) {
  if (actor.role !== "super_admin") fail();
  return { retentionDays: integer(days, 1, 2147483647) };
}
