import type {
  Application,
  Channel,
  MessageHistoryStatus,
  SenderIdentityActor,
  SenderIdentityRead,
} from "./types.ts";
import { roleHas } from "../auth/permissions.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";
import { mapMessageHistoryStatus } from "./http/message-history-mapper.ts";
import { TEMPLATE_REGISTRY_KEY, TEMPLATE_REGISTRY_LANGUAGE } from "./template-registry.ts";

interface Common {
  contentTemplateId?: string;
  senderId: string;
  recipient: string;
}
export type HumanMessageInput =
  | (Common & { channel: "sms"; sms: { body: string } })
  | (Common & { channel: "email"; email: { subject: string; body: string } })
  | (Common & { channel: "whatsapp"; whatsapp: { templateKey: string; language: string } });
export interface HumanMessageAcceptance {
  id: string;
  channel: Channel;
  status: MessageHistoryStatus;
  acceptedAt: string;
  queuedAt: string | null;
  replay: boolean;
}
function fail(): never {
  throw new Error("Invalid human message acceptance contract");
}
export function humanMessageScope(actor: SenderIdentityActor, tenantId?: string): string {
  if (!actor.userId) fail();
  if (roleHas(actor.role, "platform.messages.submit"))
    return tenantId && isTenantUuid(tenantId) ? tenantId : fail();
  if (
    !roleHas(actor.role, "messages.send") ||
    !actor.tenantId ||
    !isTenantUuid(actor.tenantId) ||
    (tenantId !== undefined && tenantId !== actor.tenantId)
  )
    fail();
  return actor.tenantId;
}
export function humanMessageKey(actor: SenderIdentityActor, tenantId?: string) {
  return ["humanMessage", actor.userId, actor.role, actor.tenantId, tenantId ?? null] as const;
}
export function humanMessagePath(
  actor: SenderIdentityActor,
  applicationId: string,
  tenantId?: string,
) {
  const tenant = humanMessageScope(actor, tenantId);
  if (!isTenantUuid(applicationId)) fail();
  return `${roleHas(actor.role, "platform.messages.submit") ? `/tenants/${tenant}` : ""}/applications/${applicationId}/messages`;
}
function text(value: string, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max
    ? value
    : fail();
}
export function humanMessageBody(input: HumanMessageInput) {
  if (!isTenantUuid(input.senderId)) fail();
  const recipient = text(input.recipient, 320).trim();
  if (
    input.channel === "email"
      ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
      : !/^\+[1-9]\d{7,14}$/.test(recipient)
  )
    fail();
  if (
    input.contentTemplateId !== undefined &&
    (!isTenantUuid(input.contentTemplateId) || input.channel === "whatsapp")
  )
    fail();
  const common = {
    senderId: input.senderId,
    recipient,
    ...(input.contentTemplateId
      ? { contentTemplateId: input.contentTemplateId.toLowerCase() }
      : {}),
  };
  if (input.channel === "sms")
    return { ...common, channel: "SMS", sms: { body: text(input.sms.body, 1600) } };
  if (input.channel === "email")
    return {
      ...common,
      channel: "EMAIL",
      email: { subject: text(input.email.subject, 200), body: text(input.email.body, 20_000) },
    };
  if (
    input.channel !== "whatsapp" ||
    Object.hasOwn(input.whatsapp, "variables") ||
    !TEMPLATE_REGISTRY_KEY.test(input.whatsapp.templateKey) ||
    !TEMPLATE_REGISTRY_LANGUAGE.test(input.whatsapp.language)
  )
    fail();
  return {
    ...common,
    channel: "WHATSAPP",
    whatsapp: { templateKey: input.whatsapp.templateKey, language: input.whatsapp.language },
  };
}
export function humanMessageIdempotencyKey(key: string): string {
  return /^[A-Za-z0-9._:-]{16,128}$/.test(key) ? key : fail();
}
export function humanMessageSenderEligible(
  app: Application,
  sender: SenderIdentityRead,
  channel: Channel,
  tenantId: string,
) {
  return (
    app.tenantId === tenantId &&
    sender.tenantId === tenantId &&
    app.status === "active" &&
    app.scopes.includes("messages:send") &&
    app.channels.includes(channel) &&
    sender.channel === channel &&
    sender.verificationStatus === "verified" &&
    sender.operationalStatus === "active" &&
    (app.senderAccess === "all_eligible" ||
      (app.senderAccess === "allow_list" && app.allowListSenderIds?.includes(sender.id) === true))
  );
}
function timestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    fail();
  return value;
}
export function mapHumanMessageAcceptance(
  value: unknown,
  channel: Channel,
): HumanMessageAcceptance {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const row = value as Record<string, unknown>;
  if (
    typeof row["id"] !== "string" ||
    !isTenantUuid(row["id"]) ||
    row["channel"] !== channel.toUpperCase() ||
    typeof row["replay"] !== "boolean"
  )
    fail();
  const status = mapMessageHistoryStatus(row["status"]);
  const queuedAt = row["queuedAt"] === null ? null : timestamp(row["queuedAt"]);
  if (!row["replay"] && (status !== "accepted" || queuedAt !== null)) fail();
  return {
    id: row["id"],
    channel,
    status,
    acceptedAt: timestamp(row["acceptedAt"]),
    queuedAt,
    replay: row["replay"],
  };
}
