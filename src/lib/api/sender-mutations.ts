import type { SenderIdentityRead, SenderIdentityActor } from "./types.ts";
import { ApiError } from "./http/errors.ts";
export type SenderRegistration = { displayName: string; providerReference?: string } & (
  | { channel: "sms"; senderId: string; countryCode: string }
  | { channel: "email"; emailAddress: string }
  | {
      channel: "whatsapp";
      businessDisplayName: string;
      phoneNumber: string;
      countryCode: string;
      wabaId: string;
      phoneNumberId: string;
    }
);
export type SenderLifecycle =
  "submit" | "review" | "verify" | "reject" | "reopen" | "activate" | "deactivate" | "suspend";
export type LiveSenderMutation =
  | { kind: "create"; input: SenderRegistration }
  | { kind: SenderLifecycle; id: string; reason?: string };
export function availableSenderActions(
  row: SenderIdentityRead,
  platform: boolean,
): SenderLifecycle[] {
  const actions: SenderLifecycle[] = [];
  if (row.verificationStatus === "draft") actions.push("submit");
  if (row.verificationStatus === "rejected") actions.push("reopen");
  if (platform && row.verificationStatus === "submitted") actions.push("review");
  if (platform && row.verificationStatus === "pending_verification")
    actions.push("verify", "reject");
  if (row.verificationStatus === "verified" && row.operationalStatus !== "active")
    actions.push("activate");
  if (row.operationalStatus !== "inactive") actions.push("deactivate");
  if (row.operationalStatus !== "suspended") actions.push("suspend");
  return actions;
}
export function senderMutationKey(actor: SenderIdentityActor, tenantId?: string) {
  return [
    "senderMutation",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? tenantId : actor.tenantId,
  ] as const;
}
export function senderMutationFailureKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "liveSenders.error.forbidden";
    if (error.statusCode === 404) return "liveSenders.error.notFound";
    if (error.statusCode === 409) return "liveSenders.error.conflict";
    if (error.statusCode === 400 || error.statusCode === 422) return "liveSenders.error.validation";
  }
  return "liveSenders.error.request";
}
