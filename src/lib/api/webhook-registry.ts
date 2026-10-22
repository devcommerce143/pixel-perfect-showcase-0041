import type { SenderIdentityActor } from "./types.ts";
import { ApiError } from "./http/errors.ts";
export const WEBHOOK_EVENTS = [
  "message.accepted",
  "message.queued",
  "message.submitted",
  "message.unknown",
  "message.failed",
  "message.delivered",
  "message.read",
] as const;
export const WEBHOOK_DELIVERY_STATES = [
  "PENDING",
  "CLAIMED",
  "SUCCEEDED",
  "EXHAUSTED",
  "CANCELLED",
] as const;
export type WebhookSubscription = (typeof WEBHOOK_EVENTS)[number];
export interface RegisteredWebhook {
  id: string;
  applicationId: string;
  url: string;
  description: string | null;
  status: "ACTIVE" | "DISABLED";
  eventTypes: WebhookSubscription[];
  secretVersion: number;
  hasPreviousSecret: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface RegisteredWebhookInput {
  url: string;
  description?: string | null;
  eventTypes: WebhookSubscription[];
}
export interface WebhookHistoryQuery {
  page: number;
  pageSize: number;
}
export interface WebhookAttempt {
  id: string;
  eventId: string;
  eventType: WebhookSubscription | "endpoint.ping";
  state: (typeof WEBHOOK_DELIVERY_STATES)[number];
  attemptCount: number;
  lastHttpStatus: number | null;
  lastErrorCategory: string | null;
  nextAttemptAt: string;
  createdAt: string;
  finishedAt: string | null;
}
export interface WebhookHistoryPage extends WebhookHistoryQuery {
  items: WebhookAttempt[];
  total: number;
}
export type WebhookRegistryOperation =
  | { kind: "create"; input: RegisteredWebhookInput }
  | { kind: "update"; id: string; input: RegisteredWebhookInput }
  | { kind: "enable" | "disable" | "rotate" | "ping" | "delete"; id: string };
export type WebhookRegistryMutationResult =
  | { kind: "endpoint"; endpoint: RegisteredWebhook }
  | { kind: "secret"; endpoint: RegisteredWebhook; secret: string }
  | { kind: "queued"; eventId: string }
  | { kind: "deleted"; id: string };
export function webhookScopeKey(
  actor: SenderIdentityActor,
  applicationId: string,
  tenantId?: string,
) {
  return [
    "webhookRegistry",
    actor.userId,
    actor.role,
    actor.tenantId,
    actor.role === "super_admin" ? tenantId : actor.tenantId,
    applicationId,
  ] as const;
}
export function webhookHistoryKey(
  actor: SenderIdentityActor,
  applicationId: string,
  endpointId: string,
  query: WebhookHistoryQuery,
  tenantId?: string,
) {
  return [
    ...webhookScopeKey(actor, applicationId, tenantId),
    "history",
    endpointId,
    query,
  ] as const;
}
export function webhookFailureKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "liveWebhooks.error.forbidden";
    if (error.statusCode === 404) return "liveWebhooks.error.notFound";
    if (error.statusCode === 409) return "liveWebhooks.error.conflict";
    if (error.statusCode === 400 || error.statusCode === 422)
      return "liveWebhooks.error.validation";
  }
  return "liveWebhooks.error.request";
}
