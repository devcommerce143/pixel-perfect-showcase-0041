import type { NotificationKind } from "./notification-contract.ts";
import type { MessageKey } from "../i18n/en.ts";

/** Exhaustive kind-to-copy map: never render unknown events as access changes. */
export const notificationCopy = {
  ACCESS_CHANGED: { title: "notifications.accessTitle", body: "notifications.accessBody" },
  QUOTA_THRESHOLD: { title: "notifications.quotaTitle", body: "notifications.quotaBody" },
  SENDING_RESTRICTED: {
    title: "notifications.restrictedTitle",
    body: "notifications.restrictedBody",
  },
  BULK_COMPLETED: {
    title: "notifications.bulkCompleteTitle",
    body: "notifications.bulkCompleteBody",
  },
  BULK_COMPLETED_WITH_FAILURES: {
    title: "notifications.bulkFailuresTitle",
    body: "notifications.bulkFailuresBody",
  },
  SUBSCRIPTION_CHANGED: {
    title: "notifications.subscriptionTitle",
    body: "notifications.subscriptionBody",
  },
  CHANNEL_ACCESS_CHANGED: {
    title: "notifications.channelTitle",
    body: "notifications.channelBody",
  },
  SENDER_APPROVED: {
    title: "notifications.senderApprovedTitle",
    body: "notifications.senderApprovedBody",
  },
  SENDER_VERIFICATION_REQUESTED: {
    title: "notifications.senderRequestedTitle",
    body: "notifications.senderRequestedBody",
  },
  SENDER_SUSPENDED: {
    title: "notifications.senderSuspendedTitle",
    body: "notifications.senderSuspendedBody",
  },
  SENDER_REJECTED: {
    title: "notifications.senderRejectedTitle",
    body: "notifications.senderRejectedBody",
  },
  TEMPLATE_APPROVAL_CHANGED: {
    title: "notifications.templateTitle",
    body: "notifications.templateBody",
  },
  MESSAGE_FAILED: {
    title: "notifications.messageFailedTitle",
    body: "notifications.messageFailedBody",
  },
  MESSAGE_UNCERTAIN: {
    title: "notifications.messageUncertainTitle",
    body: "notifications.messageUncertainBody",
  },
  PROVIDER_UNHEALTHY: {
    title: "notifications.providerUnhealthyTitle",
    body: "notifications.providerUnhealthyBody",
  },
  PROVIDER_RECOVERED: {
    title: "notifications.providerRecoveredTitle",
    body: "notifications.providerRecoveredBody",
  },
  PROVIDER_FAILOVER: { title: "notifications.failoverTitle", body: "notifications.failoverBody" },
  CREDENTIAL_CHANGED: {
    title: "notifications.credentialTitle",
    body: "notifications.credentialBody",
  },
  SECURITY_CHANGED: { title: "notifications.securityTitle", body: "notifications.securityBody" },
} as const satisfies Record<NotificationKind, { title: MessageKey; body: MessageKey }>;
