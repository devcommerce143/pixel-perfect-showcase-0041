import type { SenderIdentityActor } from "../types.ts";
import {
  REGISTRY_STATUSES,
  TEMPLATE_APPROVAL_STATUSES,
  TEMPLATE_REGISTRY_KEY,
  TEMPLATE_REGISTRY_LANGUAGE,
} from "../template-registry.ts";
import type {
  RegistryTemplate,
  RegistryQuery,
  RegistryPage,
  RegisterTemplateInput,
  TemplateEvidenceInput,
} from "../template-registry.ts";

function fail(): never {
  throw new Error("Invalid template registry contract");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function string(value: unknown): string {
  return typeof value === "string" ? value : fail();
}
function uuid(value: unknown): string {
  const text = string(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
    ? text
    : fail();
}
function integer(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : fail();
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? (value as T) : fail();
}
function instant(value: unknown): string {
  const text = string(value);
  const date = new Date(text);
  return Number.isFinite(date.getTime()) && date.toISOString() === text ? text : fail();
}
export function registryPath(actor: SenderIdentityActor, tenantId?: string): string {
  if (actor.role === "super_admin") {
    if (!tenantId) throw new Error("A named tenant is required");
    return `/tenants/${uuid(tenantId)}/templates`;
  }
  uuid(actor.tenantId);
  if (tenantId && tenantId !== actor.tenantId) throw new Error("Tenant context mismatch");
  return "/templates";
}
export function registryItemPath(actor: SenderIdentityActor, id: string, tenantId?: string) {
  return `${registryPath(actor, tenantId)}/${uuid(id)}`;
}
export function registryQueryString(query: RegistryQuery) {
  if (integer(query.page) < 1 || integer(query.pageSize) < 1 || query.pageSize > 100) fail();
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.registryStatus)
    params.set("registryStatus", enumValue(query.registryStatus, REGISTRY_STATUSES));
  if (query.providerApprovalStatus)
    params.set(
      "providerApprovalStatus",
      enumValue(query.providerApprovalStatus, TEMPLATE_APPROVAL_STATUSES),
    );
  return params.toString();
}
export function mapRegistryTemplate(
  value: unknown,
  actor: SenderIdentityActor,
  tenantId?: string,
  expectedId?: string,
): RegistryTemplate {
  const row = record(value);
  const id = uuid(row["id"]),
    actualTenant = uuid(row["tenantId"]);
  if (
    actualTenant !== (actor.role === "super_admin" ? tenantId : actor.tenantId) ||
    (expectedId && expectedId !== id)
  )
    fail();
  const templateKey = string(row["templateKey"]),
    language = string(row["language"]);
  if (!TEMPLATE_REGISTRY_KEY.test(templateKey) || !TEMPLATE_REGISTRY_LANGUAGE.test(language))
    fail();
  return {
    id,
    tenantId: actualTenant,
    channel: enumValue(row["channel"], ["WHATSAPP"]),
    templateKey,
    language,
    registryStatus: enumValue(row["registryStatus"], REGISTRY_STATUSES),
    providerApprovalStatus: enumValue(row["providerApprovalStatus"], TEMPLATE_APPROVAL_STATUSES),
    evidenceSource:
      row["evidenceSource"] === null
        ? null
        : enumValue(row["evidenceSource"], ["PROVIDER_SYNC", "OPERATOR_RECORDED"] as const),
    providerTemplateId:
      row["providerTemplateId"] === null ? null : string(row["providerTemplateId"]),
    approvalObservedAt:
      row["approvalObservedAt"] === null ? null : instant(row["approvalObservedAt"]),
    createdAt: instant(row["createdAt"]),
    updatedAt: instant(row["updatedAt"]),
  };
}
export function mapRegistryPage(
  value: unknown,
  actor: SenderIdentityActor,
  tenantId?: string,
): RegistryPage {
  const row = record(value),
    page = integer(row["page"]),
    pageSize = integer(row["pageSize"]),
    total = integer(row["total"]);
  if (
    page < 1 ||
    pageSize < 1 ||
    pageSize > 100 ||
    !Array.isArray(row["items"]) ||
    row["items"].length > pageSize
  )
    fail();
  return {
    page,
    pageSize,
    total,
    items: row["items"].map((value) => mapRegistryTemplate(value, actor, tenantId)),
  };
}
export function registerTemplateRequest(input: RegisterTemplateInput) {
  const templateKey = input.templateKey.trim(),
    language = input.language.trim();
  if (!TEMPLATE_REGISTRY_KEY.test(templateKey) || !TEMPLATE_REGISTRY_LANGUAGE.test(language))
    fail();
  return { channel: "WHATSAPP", templateKey, language };
}
export function evidenceRequest(
  actor: SenderIdentityActor,
  input: TemplateEvidenceInput,
  now = new Date(),
) {
  if (actor.role !== "super_admin") throw new Error("Platform context required");
  const providerApprovalStatus = enumValue(
    input.providerApprovalStatus,
    TEMPLATE_APPROVAL_STATUSES,
  );
  if (providerApprovalStatus !== "APPROVED") return { providerApprovalStatus };
  const providerTemplateId = input.providerTemplateId?.trim();
  if (!providerTemplateId || providerTemplateId.length > 128 || !input.approvalObservedAt) fail();
  const approvalObservedAt = instant(input.approvalObservedAt);
  if (Date.parse(approvalObservedAt) > now.getTime()) fail();
  return { providerApprovalStatus, providerTemplateId, approvalObservedAt };
}
