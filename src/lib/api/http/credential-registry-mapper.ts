import type { SenderIdentityActor } from "../types.ts";
import { CREDENTIAL_SCOPES, CREDENTIAL_STATUSES } from "../credential-registry.ts";
import type {
  CredentialMetadata,
  CredentialIssueInput,
  CredentialRegistryQuery,
  CredentialRegistryPage,
  IssuedRegistryCredential,
} from "../credential-registry.ts";

function fail(): never {
  throw new Error("Invalid credential registry contract");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function text(value: unknown, max = 256): string {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : fail();
}
function uuid(value: unknown): string {
  const id = text(value);
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ? id : fail();
}
function nullableUuid(value: unknown) {
  return value === null ? null : uuid(value);
}
function integer(value: unknown, min = 0): number {
  return Number.isSafeInteger(value) && (value as number) >= min ? (value as number) : fail();
}
function instant(value: unknown): string {
  const result = text(value),
    date = new Date(result);
  return Number.isFinite(date.getTime()) && date.toISOString() === result ? result : fail();
}
function nullableInstant(value: unknown) {
  return value === null ? null : instant(value);
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  return choices.includes(value as T) ? (value as T) : fail();
}
export function credentialTenant(actor: SenderIdentityActor, tenantId?: string) {
  if (actor.role === "super_admin") return uuid(tenantId);
  const resolved = uuid(actor.tenantId);
  if (tenantId && tenantId !== resolved) fail();
  return resolved;
}
export function credentialBasePath(
  actor: SenderIdentityActor,
  applicationId: string,
  tenantId?: string,
) {
  const tenant = credentialTenant(actor, tenantId),
    application = uuid(applicationId);
  return `${actor.role === "super_admin" ? `/tenants/${tenant}` : ""}/applications/${application}/credentials`;
}
export function credentialItemPath(
  actor: SenderIdentityActor,
  applicationId: string,
  id: string,
  tenantId?: string,
) {
  return `${credentialBasePath(actor, applicationId, tenantId)}/${uuid(id)}`;
}
export function credentialQueryString(query: CredentialRegistryQuery) {
  const page = integer(query.page, 1),
    pageSize = integer(query.pageSize, 1);
  if (pageSize > 100 || (page - 1) * pageSize > 2147483647) fail();
  return new URLSearchParams({ page: String(page), pageSize: String(pageSize) }).toString();
}
export function credentialIssueBody(input: CredentialIssueInput) {
  if (
    !Array.isArray(input.scopes) ||
    input.scopes.length === 0 ||
    new Set(input.scopes).size !== input.scopes.length
  )
    fail();
  const scopes = input.scopes.map((scope) => choice(scope, CREDENTIAL_SCOPES));
  const expiresAt = input.expiresAt === undefined ? undefined : instant(input.expiresAt);
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) fail();
  const rate =
    input.rateLimitPerSecondOverride === undefined
      ? undefined
      : integer(input.rateLimitPerSecondOverride, 1);
  if (rate !== undefined && rate > 2147483647) fail();
  return {
    scopes,
    ...(expiresAt ? { expiresAt } : {}),
    ...(rate === undefined ? {} : { rateLimitPerSecondOverride: rate }),
  };
}
export function credentialRevokeBody(reason: string) {
  return { reason: text(reason.trim(), 500) };
}
export function mapCredentialMetadata(
  value: unknown,
  actor: SenderIdentityActor,
  applicationId: string,
  tenantId?: string,
  expectedId?: string,
): CredentialMetadata {
  const row = record(value),
    id = uuid(row["id"]),
    tenant = uuid(row["tenantId"]),
    application = uuid(row["applicationId"]);
  if (
    tenant !== credentialTenant(actor, tenantId) ||
    application !== uuid(applicationId) ||
    (expectedId && id !== uuid(expectedId))
  )
    fail();
  if (!Array.isArray(row["scopes"])) fail();
  const scopes = row["scopes"].map((scope) => choice(scope, CREDENTIAL_SCOPES));
  if (scopes.length === 0 || new Set(scopes).size !== scopes.length) fail();
  return {
    id,
    tenantId: tenant,
    applicationId: application,
    clientId: text(row["clientId"]),
    secretPrefix: text(row["secretPrefix"]),
    status: choice(row["status"], CREDENTIAL_STATUSES),
    effectiveStatus: choice(row["effectiveStatus"], CREDENTIAL_STATUSES),
    scopes,
    expiresAt: nullableInstant(row["expiresAt"]),
    lastUsedAt: nullableInstant(row["lastUsedAt"]),
    rateLimitPerSecondOverride:
      row["rateLimitPerSecondOverride"] === null
        ? null
        : integer(row["rateLimitPerSecondOverride"], 1),
    createdByUserId: nullableUuid(row["createdByUserId"]),
    revokedAt: nullableInstant(row["revokedAt"]),
    revokedByUserId: nullableUuid(row["revokedByUserId"]),
    revokeReason: row["revokeReason"] === null ? null : text(row["revokeReason"], 500),
    rotatedFromCredentialId: nullableUuid(row["rotatedFromCredentialId"]),
    createdAt: instant(row["createdAt"]),
    updatedAt: instant(row["updatedAt"]),
  };
}
export function mapCredentialRegistryPage(
  value: unknown,
  actor: SenderIdentityActor,
  applicationId: string,
  query: CredentialRegistryQuery,
  tenantId?: string,
): CredentialRegistryPage {
  credentialQueryString(query);
  const row = record(value),
    total = integer(row["total"]);
  if (
    row["page"] !== query.page ||
    row["pageSize"] !== query.pageSize ||
    !Array.isArray(row["items"])
  )
    fail();
  const items = row["items"].map((item) =>
    mapCredentialMetadata(item, actor, applicationId, tenantId),
  );
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.length !==
      Math.min(query.pageSize, Math.max(0, total - (query.page - 1) * query.pageSize))
  )
    fail();
  return { items, page: query.page, pageSize: query.pageSize, total };
}
export function mapIssuedRegistryCredential(
  value: unknown,
  actor: SenderIdentityActor,
  applicationId: string,
  tenantId?: string,
  predecessorId?: string,
): IssuedRegistryCredential {
  const row = record(value),
    credential = mapCredentialMetadata(row, actor, applicationId, tenantId);
  if (credential.status !== "ACTIVE" || credential.effectiveStatus !== "ACTIVE") fail();
  if (
    predecessorId
      ? credential.id === uuid(predecessorId) ||
        credential.rotatedFromCredentialId !== predecessorId
      : credential.rotatedFromCredentialId !== null
  )
    fail();
  return { credential, secret: text(row["secret"], 4096) };
}
