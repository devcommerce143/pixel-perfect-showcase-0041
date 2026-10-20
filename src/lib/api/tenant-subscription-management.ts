import { ApiError } from "./http/errors.ts";
import {
  tenantSubscriptionHistoryQueryKey,
  tenantSubscriptionQueryKey,
} from "./http/tenant-subscription-mapper.ts";
import type { TenantSubscriptionHistoryQuery } from "./types.ts";

export type TenantSubscriptionMutationErrorMessage =
  | "ten.subscriptionMutationRejected"
  | "ten.subscriptionMutationForbidden"
  | "ten.subscriptionMutationNotFound"
  | "ten.subscriptionMutationConflict"
  | "ten.subscriptionMutationEntitlement"
  | "ten.subscriptionMutationError";

export function canManageTenantSubscription(
  mode: "live" | "mock",
  hasPermission: boolean,
): boolean {
  return mode === "live" && hasPermission;
}

export function canStartTenantSubscriptionMutation(
  mode: "live" | "mock",
  hasPermission: boolean,
  hasCurrentSubscription: boolean,
  isPending: boolean,
): boolean {
  return canManageTenantSubscription(mode, hasPermission) && hasCurrentSubscription && !isPending;
}

export function tenantSubscriptionRefreshQueryFilters(
  tenantId: string,
  historyQuery: TenantSubscriptionHistoryQuery,
  includeHistory: boolean,
) {
  return {
    current: { queryKey: tenantSubscriptionQueryKey(tenantId), exact: true },
    history: includeHistory
      ? { queryKey: tenantSubscriptionHistoryQueryKey(tenantId, historyQuery), exact: true }
      : null,
  } as const;
}

export function tenantSubscriptionMutationErrorMessage(
  error: unknown,
): TenantSubscriptionMutationErrorMessage {
  if (!(error instanceof ApiError)) return "ten.subscriptionMutationError";
  if (error.statusCode === 400) return "ten.subscriptionMutationRejected";
  if (error.statusCode === 403) return "ten.subscriptionMutationForbidden";
  if (error.statusCode === 404) return "ten.subscriptionMutationNotFound";
  if (error.statusCode === 409) return "ten.subscriptionMutationConflict";
  if (error.statusCode === 422) return "ten.subscriptionMutationEntitlement";
  return "ten.subscriptionMutationError";
}

export function isPositiveIntegerInput(value: string): boolean {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

export function isNonNegativeIntegerInput(value: string): boolean {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= 0;
}

export function channelCanBeEnabled(
  planEnablesChannel: boolean,
  enabledOverride: boolean | null,
): boolean {
  return planEnablesChannel || enabledOverride !== true;
}
