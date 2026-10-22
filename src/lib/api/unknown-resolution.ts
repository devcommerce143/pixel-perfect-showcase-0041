import type { MessageHistoryDetail, SenderIdentityActor } from "./types.ts";
import { roleHas } from "../auth/permissions.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";

export type UnknownResolutionDecision = "commit" | "record_acceptance" | "release";
export interface UnknownResolutionInput {
  decision: UnknownResolutionDecision;
  reason: string;
  evidenceReference: string;
  providerMessageId?: string;
}
export interface UnknownResolutionResult {
  messageId: string;
  decision: UnknownResolutionDecision;
  messageStatus: "unknown" | "submitted";
  reservationState: "committed" | "released";
  changed: boolean;
}
function fail(): never {
  throw new Error("Invalid UNKNOWN resolution contract");
}
export function unknownResolutionKey(
  actor: SenderIdentityActor,
  tenantId: string,
  messageId: string,
) {
  return [
    "unknownResolution",
    actor.userId,
    actor.role,
    actor.tenantId,
    "platform",
    tenantId,
    messageId,
  ] as const;
}
export function unknownResolutionPath(
  actor: SenderIdentityActor,
  tenantId: string,
  messageId: string,
) {
  if (
    !actor.userId ||
    !roleHas(actor.role, "platform.messages.resolveUnknown") ||
    !isTenantUuid(tenantId) ||
    !isTenantUuid(messageId)
  )
    fail();
  return `/tenants/${tenantId}/messages/${messageId}/unknown-resolution`;
}
export function unknownResolutionAvailable(
  actor: SenderIdentityActor,
  tenantId: string | undefined,
  message: MessageHistoryDetail,
) {
  return (
    !!actor.userId &&
    roleHas(actor.role, "platform.messages.resolveUnknown") &&
    !!tenantId &&
    isTenantUuid(tenantId) &&
    isTenantUuid(message.id) &&
    message.channel === "sms" &&
    message.status === "unknown" &&
    message.attempts.some((attempt) => attempt.state === "unknown")
  );
}
function text(value: string, min: number, max: number) {
  if (typeof value !== "string") fail();
  const result = value.trim();
  if (result.length < min || result.length > max || /[\r\n]/.test(result)) fail();
  return result;
}
export function unknownResolutionBody(input: UnknownResolutionInput): UnknownResolutionInput {
  if (!["commit", "record_acceptance", "release"].includes(input.decision)) fail();
  const result: UnknownResolutionInput = {
    decision: input.decision,
    reason: text(input.reason, 8, 500),
    evidenceReference: text(input.evidenceReference, 4, 128),
  };
  if (input.decision === "record_acceptance") {
    if (!input.providerMessageId || !/^[0-9]{1,128}$/.test(input.providerMessageId)) fail();
    result.providerMessageId = input.providerMessageId;
  } else if (input.providerMessageId !== undefined) fail();
  return result;
}
export function mapUnknownResolution(
  value: unknown,
  messageId: string,
  decision: UnknownResolutionDecision,
): UnknownResolutionResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const row = value as Record<string, unknown>;
  const status = decision === "record_acceptance" ? "SUBMITTED" : "UNKNOWN";
  const reservation = decision === "release" ? "RELEASED" : "COMMITTED";
  if (
    row["messageId"] !== messageId ||
    row["decision"] !== decision ||
    row["messageStatus"] !== status ||
    row["reservationState"] !== reservation ||
    typeof row["changed"] !== "boolean"
  )
    fail();
  return {
    messageId,
    decision,
    messageStatus: status === "SUBMITTED" ? "submitted" : "unknown",
    reservationState: reservation === "RELEASED" ? "released" : "committed",
    changed: row["changed"],
  };
}
