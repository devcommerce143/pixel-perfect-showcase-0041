import type { SenderIdentityActor, SenderIdentityRead } from "./types.ts";
import { ApiError } from "./http/errors.ts";
export interface StoredSenderBinding {
  id: string;
  tenantId: string;
  senderIdentityId: string;
  providerAccountId: string;
  providerSenderName: string;
  createdAt: string;
  updatedAt: string;
}
export interface SenderBindingQuery {
  tenantId: string;
  providerAccountId?: string;
  senderIdentityId?: string;
  limit: number;
  cursor?: string;
}
export interface SenderBindingPage {
  items: StoredSenderBinding[];
  nextCursor: string | null;
}
export type SenderBindingOperation =
  | {
      kind: "create";
      channel: "SMS";
      tenantId: string;
      senderIdentityId: string;
      providerAccountId: string;
      providerSenderName: string;
    }
  | {
      kind: "create";
      channel: "EMAIL" | "WHATSAPP";
      tenantId: string;
      senderIdentityId: string;
      providerAccountId: string;
    }
  | { kind: "remove"; id: string; tenantId: string; providerAccountId: string };
export type SenderBindingMutationResult =
  { kind: "created"; binding: StoredSenderBinding } | { kind: "removed"; id: string };
export function senderBindingKey(actor: SenderIdentityActor, tenantId: string, account: string) {
  return [
    "senderBindings",
    actor.userId,
    actor.role,
    actor.tenantId,
    "platform",
    tenantId,
    account,
  ] as const;
}
export function bindingSenderReady(
  sender: SenderIdentityRead,
  channel: "SMS" | "EMAIL" | "WHATSAPP",
) {
  if (sender.channel.toUpperCase() !== channel) return false;
  if (sender.channel === "sms") return true;
  if (sender.verificationStatus !== "verified" || sender.operationalStatus !== "active")
    return false;
  if (sender.channel === "email")
    return (
      sender.email.domainVerificationStatus === "verified" &&
      sender.email.spfStatus === "verified" &&
      sender.email.dkimStatus === "verified"
    );
  return (
    /^[0-9]{1,64}$/.test(sender.whatsapp.phoneNumberId) &&
    /^[0-9]{1,64}$/.test(sender.whatsapp.wabaId) &&
    sender.whatsapp.phoneNumberId !== sender.whatsapp.wabaId
  );
}
export function senderBindingFailureKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "senderBindings.forbidden";
    if (error.statusCode === 409) return "senderBindings.conflict";
    if (error.statusCode === 400 || error.statusCode === 422) return "senderBindings.validation";
  }
  return "senderBindings.error";
}
