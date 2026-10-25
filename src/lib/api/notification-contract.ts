/** Version 1: identifiers/enums only. Never accept arbitrary display text. */
export const NOTIFICATION_KINDS = [
  "ACCESS_CHANGED",
  "QUOTA_THRESHOLD",
  "SENDING_RESTRICTED",
  "BULK_COMPLETED",
  "BULK_COMPLETED_WITH_FAILURES",
  "SUBSCRIPTION_CHANGED",
  "CHANNEL_ACCESS_CHANGED",
  "SENDER_APPROVED",
  "SENDER_REJECTED",
  "TEMPLATE_APPROVAL_CHANGED",
  "MESSAGE_FAILED",
  "MESSAGE_UNCERTAIN",
  "PROVIDER_UNHEALTHY",
  "PROVIDER_RECOVERED",
  "PROVIDER_FAILOVER",
  "CREDENTIAL_CHANGED",
  "SECURITY_CHANGED",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationContext = {
  channel?: "SMS" | "EMAIL" | "WHATSAPP";
  threshold?: 80 | 90 | 100;
  /** Target resource scope, never the recipient inbox scope. Not display text. */
  targetTenantId?: string;
};
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?![\s\S])/i;
export function validateNotification(
  kind: unknown,
  value: unknown = {},
): {
  kind: NotificationKind;
  context: NotificationContext;
} {
  if (
    !NOTIFICATION_KINDS.includes(kind as NotificationKind) ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  )
    throw new Error("Invalid notification event");
  const context = value as Record<string, unknown>;
  if (
    Object.keys(context).some((key) => !["channel", "threshold", "targetTenantId"].includes(key)) ||
    (kind === "ACCESS_CHANGED" && Object.keys(context).length > 0) ||
    ("channel" in context &&
      !["SMS", "EMAIL", "WHATSAPP"].includes(context["channel"] as string)) ||
    ("targetTenantId" in context &&
      (typeof context["targetTenantId"] !== "string" || !uuid.test(context["targetTenantId"]))) ||
    (kind === "QUOTA_THRESHOLD"
      ? ![80, 90, 100].includes(context["threshold"] as number)
      : "threshold" in context)
  )
    throw new Error("Invalid notification context");
  return { kind: kind as NotificationKind, context: { ...context } as NotificationContext };
}
