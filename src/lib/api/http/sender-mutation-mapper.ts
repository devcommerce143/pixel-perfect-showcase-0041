import { mapSenderIdentity, senderIdentityDetailPath } from "./sender-identity-mapper.ts";
import { isTenantUuid } from "./tenant-mapper.ts";
import type { SenderIdentityActor } from "../types.ts";
import type { LiveSenderMutation, SenderRegistration } from "../sender-mutations.ts";
function fail(): never {
  throw new Error("Invalid sender mutation contract");
}
function text(value: string, max: number) {
  const result = value.trim();
  return result.length > 0 && result.length <= max ? result : fail();
}
function country(value: string) {
  const result = text(value, 2).toUpperCase();
  return /^[A-Z]{2}$/.test(result) ? result : fail();
}
function senderBody(input: SenderRegistration) {
  const common = {
    channel: input.channel.toUpperCase(),
    displayName: text(input.displayName, 200),
    ...(input.providerReference?.trim()
      ? { providerReference: text(input.providerReference, 255) }
      : {}),
  };
  if (input.channel === "sms") {
    const senderId = text(input.senderId, 11);
    if (!/^[A-Za-z0-9]{3,11}$/.test(senderId)) fail();
    return { ...common, sms: { senderId, countryCode: country(input.countryCode) } };
  }
  if (input.channel === "email") {
    const emailAddress = text(input.emailAddress, 320);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) fail();
    return { ...common, email: { emailAddress } };
  }
  if (input.channel !== "whatsapp") return fail();
  const phoneNumber = text(input.phoneNumber, 20);
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) fail();
  return {
    ...common,
    whatsapp: {
      businessDisplayName: text(input.businessDisplayName, 200),
      phoneNumber,
      countryCode: country(input.countryCode),
      wabaId: text(input.wabaId, 64),
      phoneNumberId: text(input.phoneNumberId, 64),
    },
  };
}
export function senderMutationRequest(
  actor: SenderIdentityActor,
  operation: LiveSenderMutation,
  tenantId?: string,
) {
  const tenant = actor.role === "super_admin" ? tenantId : actor.tenantId;
  if (
    !isTenantUuid(tenant ?? "") ||
    (actor.role !== "super_admin" && tenantId && tenantId !== tenant)
  )
    fail();
  const base = actor.role === "super_admin" ? `/tenants/${tenant}/senders` : "/senders";
  if (operation.kind === "create") return { path: base, body: senderBody(operation.input) };
  if (
    ![
      "submit",
      "review",
      "verify",
      "reject",
      "reopen",
      "activate",
      "deactivate",
      "suspend",
    ].includes(operation.kind)
  )
    fail();
  if (["review", "verify", "reject"].includes(operation.kind) && actor.role !== "super_admin")
    fail();
  const path = `${senderIdentityDetailPath(actor.role, operation.id, tenantId)}/${operation.kind}`;
  return {
    path,
    body:
      operation.kind === "reject" || operation.kind === "suspend"
        ? { reason: text(operation.reason ?? "", 500) }
        : {},
  };
}
export function mapSenderMutation(
  value: unknown,
  actor: SenderIdentityActor,
  operation: LiveSenderMutation,
  tenantId?: string,
) {
  const result = mapSenderIdentity(value);
  if (
    result.tenantId !== (actor.role === "super_admin" ? tenantId : actor.tenantId) ||
    (operation.kind !== "create" && result.id !== operation.id)
  )
    fail();
  if (operation.kind === "create") {
    if (
      result.channel !== operation.input.channel ||
      result.verificationStatus !== "draft" ||
      result.operationalStatus !== "inactive"
    )
      fail();
  }
  const verification = {
    submit: "submitted",
    review: "pending_verification",
    verify: "verified",
    reject: "rejected",
    reopen: "draft",
  } as const;
  if (
    operation.kind in verification &&
    result.verificationStatus !== verification[operation.kind as keyof typeof verification]
  )
    fail();
  const operational = { activate: "active", deactivate: "inactive", suspend: "suspended" } as const;
  if (
    operation.kind in operational &&
    result.operationalStatus !== operational[operation.kind as keyof typeof operational]
  )
    fail();
  return result;
}
