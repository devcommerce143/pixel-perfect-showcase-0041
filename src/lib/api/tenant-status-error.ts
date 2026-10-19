import { ApiError } from "./http/errors.ts";

export type TenantStatusErrorMessage =
  | "ten.statusRejected"
  | "ten.statusForbidden"
  | "ten.statusNotFound"
  | "ten.statusConflict"
  | "ten.statusError";

export function tenantStatusErrorMessage(error: unknown): TenantStatusErrorMessage {
  if (!(error instanceof ApiError)) return "ten.statusError";
  if (error.statusCode === 400) return "ten.statusRejected";
  if (error.statusCode === 403) return "ten.statusForbidden";
  if (error.statusCode === 404) return "ten.statusNotFound";
  if (error.statusCode === 409) return "ten.statusConflict";
  return "ten.statusError";
}
