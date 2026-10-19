import { ApiError } from "./http/errors.ts";
import type { MessageKey } from "@/lib/i18n/i18n";
import type { PortalUser, UserStatus } from "./types.ts";

export type UserMutation = "create" | "profile" | "role" | "status";

export function userMutationErrorMessage(error: unknown, mutation: UserMutation): MessageKey {
  if (!(error instanceof ApiError)) {
    return mutation === "create" ? "users.createError" : "users.requestError";
  }
  if (error.statusCode === 409) {
    if (mutation === "create") return "users.duplicateEmail";
    if (mutation === "role") return "users.roleRejected";
    if (mutation === "status") return "users.transitionRejected";
  }
  if (error.statusCode === 400 || error.statusCode === 422) {
    return mutation === "create" ? "users.createRejected" : "users.requestRejected";
  }
  if (error.statusCode === 401 || error.statusCode === 403) {
    return "users.accessDenied";
  }
  if (error.statusCode === 404) return "users.notFound";
  return mutation === "create" ? "users.createError" : "users.requestError";
}

export function availableUserStatusTransitions(status: PortalUser["status"]): UserStatus[] {
  const transitions: Record<PortalUser["status"], UserStatus[]> = {
    invited: ["active", "suspended", "disabled"],
    active: ["suspended", "disabled"],
    suspended: ["active", "disabled"],
    disabled: ["active"],
    pending_activation: [],
  };
  return transitions[status];
}
