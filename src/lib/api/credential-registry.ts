import type { SenderIdentityActor } from "./types.ts";
import { ApiError } from "./http/errors.ts";

export const CREDENTIAL_SCOPES = [
  "MESSAGES_SEND",
  "MESSAGES_READ",
  "TEMPLATES_READ",
  "WEBHOOKS_MANAGE",
] as const;
export const CREDENTIAL_STATUSES = ["ACTIVE", "REVOKED", "EXPIRED"] as const;
export type CredentialScope = (typeof CREDENTIAL_SCOPES)[number];
export interface CredentialMetadata {
  id: string;
  tenantId: string;
  applicationId: string;
  clientId: string;
  secretPrefix: string;
  status: (typeof CREDENTIAL_STATUSES)[number];
  effectiveStatus: (typeof CREDENTIAL_STATUSES)[number];
  scopes: CredentialScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  rateLimitPerSecondOverride: number | null;
  createdByUserId: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokeReason: string | null;
  rotatedFromCredentialId: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CredentialIssueInput {
  scopes: CredentialScope[];
  expiresAt?: string;
  rateLimitPerSecondOverride?: number;
}
export interface IssuedRegistryCredential {
  credential: CredentialMetadata;
  secret: string;
}
export interface CredentialRegistryQuery {
  page: number;
  pageSize: number;
}
export interface CredentialRegistryPage extends CredentialRegistryQuery {
  items: CredentialMetadata[];
  total: number;
}
export function credentialScopeKey(
  actor: SenderIdentityActor,
  applicationId: string,
  tenantId?: string,
) {
  return [
    "credentialRegistry",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? tenantId : actor.tenantId,
    applicationId,
  ] as const;
}
export function credentialListKey(
  actor: SenderIdentityActor,
  applicationId: string,
  query: CredentialRegistryQuery,
  tenantId?: string,
) {
  return [...credentialScopeKey(actor, applicationId, tenantId), "list", query] as const;
}
export function credentialFailureKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "liveCredentials.error.forbidden";
    if (error.statusCode === 404) return "liveCredentials.error.notFound";
    if (error.statusCode === 409) return "liveCredentials.error.conflict";
    if (error.statusCode === 400 || error.statusCode === 422)
      return "liveCredentials.error.validation";
  }
  return "liveCredentials.error.request";
}
