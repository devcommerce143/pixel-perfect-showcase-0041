import type { SenderIdentityActor } from "./types.ts";
export const PROVIDER_TRANSPORTS = [
  "TAQNYAT_SMS",
  "TAQNYAT_EMAIL",
  "TAQNYAT_WHATSAPP",
  "TURBO_SMTP",
  "META_GRAPH",
] as const;
export type ProviderTransport = (typeof PROVIDER_TRANSPORTS)[number];
export const PROVIDER_HEALTH_STATES = ["UNKNOWN", "HEALTHY", "DEGRADED", "UNHEALTHY"] as const;
export const PROVIDER_FAILURE_CLASSES = [
  "AUTHENTICATION",
  "RATE_LIMIT",
  "CONNECTION",
  "TIMEOUT",
  "PROVIDER_ERROR",
  "UNEXPECTED",
] as const;
export interface ProviderMonitorQuery {
  limit: number;
  cursor?: string;
  channel?: "SMS" | "EMAIL" | "WHATSAPP";
}
export interface SmsPilotControlState {
  submissionsEnabled: boolean;
}
export interface ProviderHealthRecord {
  providerAccountId: string;
  code: string;
  channel: "SMS" | "EMAIL" | "WHATSAPP";
  transport?: ProviderTransport;
  accountStatus: "ACTIVE" | "RETIRED";
  state: (typeof PROVIDER_HEALTH_STATES)[number];
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
  lastTransitionAt: string | null;
  lastHttpStatus: number | null;
  lastLatencyMs: number | null;
  lastFailureClass: (typeof PROVIDER_FAILURE_CLASSES)[number] | null;
}
export interface ProviderRecordedCheck {
  id: string;
  providerAccountId: string;
  startedAt: string;
  finishedAt: string;
  applied: boolean;
  succeeded: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
  failureClass: (typeof PROVIDER_FAILURE_CLASSES)[number] | null;
  stateBefore: (typeof PROVIDER_HEALTH_STATES)[number];
  stateAfter: (typeof PROVIDER_HEALTH_STATES)[number];
}
export interface ProviderCursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
export interface ProviderAccountMetadata {
  id: string;
  code: string;
  channel: "SMS" | "EMAIL" | "WHATSAPP";
  transport?: ProviderTransport;
  status: "ACTIVE" | "RETIRED";
  keyVersion: number;
}
export function providerMonitorKey(actor: SenderIdentityActor) {
  return ["providerMonitoring", actor.userId, actor.role, actor.tenantId, "platform"] as const;
}
