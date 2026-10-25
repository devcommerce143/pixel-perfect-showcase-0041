import { ApiError, LiveApiNotConnectedError } from "./http/errors.ts";
import type { MessageKey } from "../i18n/en.ts";
import type { Channel, ResolvedTenantEntitlements } from "./types.ts";

export function userErrorKey(error: unknown): MessageKey {
  if (error instanceof LiveApiNotConnectedError) return "notice.unavailable";
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return "notice.session";
      case 403:
        return "notice.permission";
      case 404:
        return "notice.missing";
      case 409:
        return "notice.conflict";
      case 400:
      case 422:
        return "notice.validation";
      case 429:
        return "notice.limit";
      case 408:
      case 504:
        return "notice.timeout";
    }
  }
  return error instanceof TypeError ? "notice.connection" : "common.errorBody";
}

export function supportReference(error: unknown): string | null {
  const value = error instanceof ApiError ? error.correlationId : null;
  return value && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export function sendingRestriction(
  effective: ResolvedTenantEntitlements,
  channel: Channel,
  bulk: boolean,
): MessageKey | null {
  const reasons: Record<string, MessageKey> = {
    TENANT_SUSPENDED: "notice.tenantSuspended",
    TENANT_INACTIVE: "notice.tenantInactive",
    SUBSCRIPTION_MISSING: "notice.subscriptionMissing",
    SUBSCRIPTION_PENDING: "notice.subscriptionPending",
    SUBSCRIPTION_CANCELLED: "notice.subscriptionCancelled",
    SUBSCRIPTION_NOT_STARTED: "notice.subscriptionFuture",
    SUBSCRIPTION_ENDED: "notice.subscriptionEnded",
  };
  if (!effective.operational)
    return reasons[effective.blockers[0] ?? ""] ?? "humanSend.notOperational";
  if (bulk && !effective.features.includes("bulk_messaging")) return "notice.bulkUnavailable";
  if (!effective.channels.some((item) => item.channel === channel && item.enabled))
    return "notice.channelUnavailable";
  return null;
}
