import type { Application, Channel, SenderIdentityActor } from "./types.ts";
import { ApiError } from "./http/errors.ts";
export interface LiveApplicationCreateInput {
  name: string;
  environment: Application["environment"];
  status: Application["status"];
  channels: Channel[];
  scopes: string[];
  senderAccess: "all_eligible" | "allow_list";
  allowListSenderIds: string[];
}
export type LiveApplicationMutation =
  | { kind: "create"; input: LiveApplicationCreateInput }
  | { kind: "name"; id: string; name: string }
  | { kind: "status"; id: string; status: Application["status"] }
  | { kind: "channels"; id: string; channels: Channel[] }
  | { kind: "scopes"; id: string; scopes: string[] }
  | {
      kind: "sender-access";
      id: string;
      senderAccess: "all_eligible" | "allow_list";
      allowListSenderIds: string[];
    };
export function applicationMutationKey(actor: SenderIdentityActor, tenantId?: string) {
  return [
    "liveApplicationMutation",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? tenantId : actor.tenantId,
  ] as const;
}
export function applicationMutationFailureKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "liveApplications.error.forbidden";
    if (error.statusCode === 404) return "liveApplications.error.notFound";
    if (error.statusCode === 409) return "liveApplications.error.conflict";
    if (error.statusCode === 400 || error.statusCode === 422)
      return "liveApplications.error.validation";
  }
  return "liveApplications.error.request";
}
