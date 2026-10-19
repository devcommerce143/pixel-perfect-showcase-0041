import { ApiError } from "./http/errors.ts";

export type TenantCreateErrorMessage =
  | "ten.createConflict"
  | "ten.createRejected"
  | "ten.createForbidden"
  | "ten.createError";

export function tenantCreateErrorMessage(error: unknown): TenantCreateErrorMessage {
  if (!(error instanceof ApiError)) return "ten.createError";
  if (error.statusCode === 409) return "ten.createConflict";
  if (error.statusCode === 400) return "ten.createRejected";
  if (error.statusCode === 403) return "ten.createForbidden";
  return "ten.createError";
}
