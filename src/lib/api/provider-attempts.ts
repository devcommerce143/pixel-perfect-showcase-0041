import type { MessageHistoryAttempt, MessageHistoryStatus, SenderIdentityActor } from "./types.ts";
import { roleHas } from "../auth/permissions.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";
import {
  mapMessageHistoryAttempt,
  mapMessageHistoryStatus,
} from "./http/message-history-mapper.ts";

export interface RecordedProviderAttempt extends MessageHistoryAttempt {
  providerRouteId: string | null;
  providerAccountId: string | null;
  providerAccountCode: string | null;
  senderProviderBindingId: string | null;
}
export interface RecordedProviderAttempts {
  messageId: string;
  messageStatus: MessageHistoryStatus;
  providerChanged: boolean;
  attempts: RecordedProviderAttempt[];
}
function fail(): never {
  throw new Error("Invalid provider attempt history contract");
}
function nullableId(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === "string" && isTenantUuid(value) ? value : fail();
}
export function providerAttemptsKey(
  actor: SenderIdentityActor,
  tenantId: string,
  messageId: string,
) {
  return [
    "providerAttempts",
    actor.userId,
    actor.role,
    actor.tenantId,
    "platform",
    tenantId,
    messageId,
  ] as const;
}
export function providerAttemptsPath(
  actor: SenderIdentityActor,
  tenantId: string,
  messageId: string,
) {
  if (
    !actor.userId ||
    !roleHas(actor.role, "platform.providers") ||
    !isTenantUuid(tenantId) ||
    !isTenantUuid(messageId)
  )
    fail();
  return `/tenants/${tenantId}/message-history/${messageId}/provider-attempts`;
}
export function mapProviderAttempts(value: unknown, messageId: string): RecordedProviderAttempts {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const body = value as Record<string, unknown>;
  if (
    body["messageId"] !== messageId ||
    typeof body["providerChanged"] !== "boolean" ||
    !Array.isArray(body["attempts"])
  )
    fail();
  const attempts = body["attempts"].map((value): RecordedProviderAttempt => {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail();
    const row = value as Record<string, unknown>;
    const providerAccountId = nullableId(row["providerAccountId"]);
    const code = row["providerAccountCode"];
    if (
      code !== null &&
      (typeof code !== "string" || !code.trim() || code.length > 128 || !providerAccountId)
    )
      fail();
    return {
      ...mapMessageHistoryAttempt(row),
      providerRouteId: nullableId(row["providerRouteId"]),
      providerAccountId,
      providerAccountCode: code as string | null,
      senderProviderBindingId: nullableId(row["senderProviderBindingId"]),
    };
  });
  if (
    attempts.some(
      (attempt, index) => index > 0 && attempt.attemptNumber <= attempts[index - 1]!.attemptNumber,
    )
  )
    fail();
  const actualChange =
    new Set(
      attempts.flatMap((attempt) => (attempt.providerAccountId ? [attempt.providerAccountId] : [])),
    ).size > 1;
  if (body["providerChanged"] !== actualChange) fail();
  return {
    messageId,
    messageStatus: mapMessageHistoryStatus(body["messageStatus"]),
    providerChanged: actualChange,
    attempts,
  };
}
