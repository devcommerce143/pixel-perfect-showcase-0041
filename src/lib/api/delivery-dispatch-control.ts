import type { SenderIdentityActor } from "./types.ts";
export type DeliveryChannel = "email" | "whatsapp";
export {
  mapSmsDispatchControl as mapDeliveryDispatchControl,
  mapSmsDispatchChange as mapDeliveryDispatchChange,
  smsDispatchChangeBody as deliveryDispatchChangeBody,
} from "./sms-dispatch-control.ts";
export type { SmsDispatchControl as DeliveryDispatchControl } from "./sms-dispatch-control.ts";
export function deliveryDispatchControlPath(actor: SenderIdentityActor, channel: DeliveryChannel) {
  if (actor.role !== "super_admin" || !actor.userId || actor.tenantId !== null)
    throw new Error("Platform access required");
  if (channel !== "email" && channel !== "whatsapp")
    throw new Error("Unsupported delivery channel");
  return `/platform/delivery-dispatch/${channel}`;
}
export function deliveryDispatchControlKey(actor: SenderIdentityActor, channel: DeliveryChannel) {
  return [
    "deliveryDispatchControl",
    actor.userId,
    actor.role,
    actor.tenantId,
    channel,
    "platform",
  ] as const;
}
