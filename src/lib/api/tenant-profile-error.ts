import { ApiError } from "./http/errors.ts";

export type TenantProfileErrorMessage =
  | "ten.profileRejected"
  | "ten.profileForbidden"
  | "ten.profileNotFound"
  | "ten.profileConflict"
  | "ten.profileError";

export function tenantProfileErrorMessage(error: unknown): TenantProfileErrorMessage {
  if (!(error instanceof ApiError)) return "ten.profileError";
  if (error.statusCode === 400) return "ten.profileRejected";
  if (error.statusCode === 403) return "ten.profileForbidden";
  if (error.statusCode === 404) return "ten.profileNotFound";
  if (error.statusCode === 409) return "ten.profileConflict";
  return "ten.profileError";
}
