import type { SenderIdentityActor } from "./types.ts";
import type { UsageReportRange } from "./usage-report.ts";

export interface AdministrativeAuditQuery extends UsageReportRange {
  page: number;
  pageSize: number;
  action?: string;
  outcome?: "SUCCESS" | "DENIED" | "FAILURE";
  actorUserId?: string;
  actorCredentialId?: string;
  resourceId?: string;
}
export interface AdministrativeAuditEvent {
  id: string;
  tenantId: string | null;
  actorKind: "HUMAN" | "MACHINE" | "SYSTEM";
  actorUserId: string | null;
  actorName?: string | null;
  actorCredentialId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: "SUCCESS" | "DENIED" | "FAILURE";
  correlationId: string;
  details: Record<string, string | number | boolean>;
  createdAt: string;
}
export interface AdministrativeAuditPage {
  items: AdministrativeAuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}
export interface AuditRetentionPolicy {
  retentionDays: number;
  updatedAt: string;
  complianceConfirmationPending: true;
  deletionEnabled: false;
}
export function administrativeAuditKey(
  actor: SenderIdentityActor,
  query: AdministrativeAuditQuery | null,
  tenantId?: string,
) {
  return [
    "administrativeAudit",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? (tenantId ?? "platform") : actor.tenantId,
    query,
  ] as const;
}
