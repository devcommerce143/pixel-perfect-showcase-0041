import { roleHas } from "../auth/permissions.ts";
import type { SenderIdentityActor } from "./types.ts";
import { ApiError } from "./http/errors.ts";

export interface BulkCancellationTarget {
  tenantId: string;
  applicationId: string;
  jobId: string;
}
export interface BulkCancellationReceipt {
  id: string;
  status: "CANCELLED";
  replay: boolean;
  cancelledAt: string | null;
}
function uuid(value: string) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))
    throw new Error("Invalid bulk cancellation target");
  return value;
}
export function bulkCancellationPath(actor: SenderIdentityActor, target: BulkCancellationTarget) {
  if (!actor.userId || !roleHas(actor.role, "messages.bulk.cancel"))
    throw new Error("Bulk cancellation is not permitted");
  const tenantId = uuid(target.tenantId),
    applicationId = uuid(target.applicationId),
    jobId = uuid(target.jobId);
  if (actor.role !== "super_admin" && actor.tenantId !== tenantId)
    throw new Error("Bulk cancellation tenant mismatch");
  return `${actor.role === "super_admin" ? `/tenants/${tenantId}` : ""}/applications/${applicationId}/bulk-jobs/${jobId}/cancel`;
}
export function mapBulkCancellation(
  value: unknown,
  target: BulkCancellationTarget,
): BulkCancellationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid bulk cancellation receipt");
  const row = value as Record<string, unknown>;
  if (
    row["id"] !== uuid(target.jobId) ||
    row["status"] !== "CANCELLED" ||
    typeof row["replay"] !== "boolean"
  )
    throw new Error("Invalid bulk cancellation receipt");
  const at = row["cancelledAt"];
  if (
    at !== null &&
    (typeof at !== "string" ||
      !Number.isFinite(new Date(at).getTime()) ||
      new Date(at).toISOString() !== at)
  )
    throw new Error("Invalid bulk cancellation timestamp");
  return {
    id: target.jobId,
    status: "CANCELLED",
    replay: row["replay"],
    cancelledAt: at as string | null,
  };
}
export function bulkCancellationKey(actor: SenderIdentityActor, target: BulkCancellationTarget) {
  return [
    "bulkCancellation",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? "platform" : "tenant",
    target.tenantId,
    target.applicationId,
    target.jobId,
  ] as const;
}
export function bulkCancellationFailure(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "bulkCancel.forbidden";
    if (error.statusCode === 404) return "bulkCancel.notFound";
    if (error.statusCode === 409) return "bulkCancel.conflict";
  }
  return "bulkCancel.error";
}
