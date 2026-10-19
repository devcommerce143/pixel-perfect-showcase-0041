import { ApiError } from "./http/errors.ts";

export type TenantPlanAssignmentErrorMessage =
  | "ten.assignmentRejected"
  | "ten.assignmentForbidden"
  | "ten.assignmentNotFound"
  | "ten.assignmentConflict"
  | "ten.assignmentEntitlement"
  | "ten.assignmentError";

export function tenantPlanAssignmentErrorMessage(error: unknown): TenantPlanAssignmentErrorMessage {
  if (!(error instanceof ApiError)) return "ten.assignmentError";
  if (error.statusCode === 400) return "ten.assignmentRejected";
  if (error.statusCode === 403) return "ten.assignmentForbidden";
  if (error.statusCode === 404) return "ten.assignmentNotFound";
  if (error.statusCode === 409) return "ten.assignmentConflict";
  if (error.statusCode === 422) return "ten.assignmentEntitlement";
  return "ten.assignmentError";
}
