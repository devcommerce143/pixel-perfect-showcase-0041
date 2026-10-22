import type { SenderIdentityActor } from "./types.ts";
import { ApiError } from "./http/errors.ts";

export const REGISTRY_STATUSES = ["DRAFT", "READY", "RETIRED"] as const;
export const TEMPLATE_APPROVAL_STATUSES = [
  "UNKNOWN",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "DISABLED",
] as const;
export interface RegistryTemplate {
  id: string;
  tenantId: string;
  channel: "WHATSAPP";
  templateKey: string;
  language: string;
  registryStatus: (typeof REGISTRY_STATUSES)[number];
  providerApprovalStatus: (typeof TEMPLATE_APPROVAL_STATUSES)[number];
  evidenceSource: "PROVIDER_SYNC" | "OPERATOR_RECORDED" | null;
  providerTemplateId: string | null;
  approvalObservedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface RegistryQuery {
  page: number;
  pageSize: number;
  registryStatus?: RegistryTemplate["registryStatus"];
  providerApprovalStatus?: RegistryTemplate["providerApprovalStatus"];
}
export interface RegistryPage {
  items: RegistryTemplate[];
  page: number;
  pageSize: number;
  total: number;
}
export interface RegisterTemplateInput {
  templateKey: string;
  language: string;
}
export interface TemplateEvidenceInput {
  providerApprovalStatus: RegistryTemplate["providerApprovalStatus"];
  providerTemplateId?: string;
  approvalObservedAt?: string;
}
export const TEMPLATE_REGISTRY_KEY = /^[a-z0-9_]{1,64}$/;
export const TEMPLATE_REGISTRY_LANGUAGE = /^[a-z]{2}(?:_[A-Z]{2})?$/;
export function registryScopeKey(actor: SenderIdentityActor, tenantId?: string) {
  return [
    "templateRegistry",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? tenantId : actor.tenantId,
  ] as const;
}
export function registryListKey(
  actor: SenderIdentityActor,
  query: RegistryQuery,
  tenantId?: string,
) {
  return [...registryScopeKey(actor, tenantId), "list", query] as const;
}
export function registryDetailKey(actor: SenderIdentityActor, id: string, tenantId?: string) {
  return [...registryScopeKey(actor, tenantId), "detail", id] as const;
}
export function registryFailureKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "registry.error.forbidden";
    if (error.statusCode === 404) return "registry.error.notFound";
    if (error.statusCode === 409) return "registry.error.conflict";
    if (error.statusCode === 400 || error.statusCode === 422) return "registry.error.validation";
  }
  return "registry.error.request";
}
