import type { Channel, DashboardRecentMessage, DashboardRecentMessageStatus, DashboardRecentMessages } from "../types.ts";
import { DashboardResponseError } from "./dashboard-mapper.ts";
import type { BackendDashboardRecentMessages } from "./dashboard-messages-dto.ts";

const CHANNELS = {
  SMS: "sms",
  EMAIL: "email",
  WHATSAPP: "whatsapp",
} as const satisfies Record<string, Channel>;

const STATUSES = {
  ACCEPTED: "accepted",
  QUEUED: "queued",
  DISPATCHING: "dispatching",
  SUBMITTED: "submitted",
  FAILED: "failed",
  UNKNOWN: "unknown",
  DELIVERED: "delivered",
  READ: "read",
} as const satisfies Record<string, DashboardRecentMessageStatus>;

/**
 * Maps the engine's recent-message list.
 * Statuses stay distinct: SUBMITTED, UNKNOWN, and DISPATCHING are not folded
 * into delivered, failed, or pending. A platform list never receives a recipient.
 */
export function mapDashboardMessages(body: unknown): DashboardRecentMessages {
  const summary = readSummary(body);
  return {
    scope: summary.scope,
    tenantId: summary.tenantId,
    items: summary.items.map((item, index) => readItem(item, index, summary.scope)),
  };
}

function readSummary(body: unknown): BackendDashboardRecentMessages {
  if (!isRecord(body)) throw new DashboardResponseError("Dashboard messages response must be an object.");
  const scope = body["scope"];
  if (scope !== "platform" && scope !== "tenant") {
    throw new DashboardResponseError("Dashboard messages scope must be platform or tenant.");
  }
  const tenantId = body["tenantId"];
  if (scope === "platform" && tenantId !== null) {
    throw new DashboardResponseError("A platform message list cannot name one tenant.");
  }
  if (scope === "tenant" && !isText(tenantId)) {
    throw new DashboardResponseError("A tenant message list must name its tenant.");
  }
  if (!Array.isArray(body["items"])) throw new DashboardResponseError("Dashboard messages must be an array.");
  return body as unknown as BackendDashboardRecentMessages;
}

function readItem(value: unknown, index: number, scope: "platform" | "tenant"): DashboardRecentMessage {
  if (!isRecord(value)) throw new DashboardResponseError(`Dashboard message ${index} must be an object.`);
  const channel = CHANNELS[text(value["channel"], `items[${index}].channel`) as keyof typeof CHANNELS];
  if (!channel) throw new DashboardResponseError(`Dashboard message channel ${String(value["channel"])} is not supported.`);
  const status = STATUSES[text(value["status"], `items[${index}].status`) as keyof typeof STATUSES];
  if (!status) throw new DashboardResponseError(`Dashboard message status ${String(value["status"])} is not supported.`);
  const templateKey = value["templateKey"];
  if (typeof templateKey !== "string" && templateKey !== null) {
    throw new DashboardResponseError(`items[${index}].templateKey must be a string or null.`);
  }
  const message: DashboardRecentMessage = {
    id: text(value["id"], `items[${index}].id`),
    channel,
    status,
    acceptedAt: text(value["acceptedAt"], `items[${index}].acceptedAt`),
    applicationName: stringValue(value["applicationName"], `items[${index}].applicationName`),
    templateKey,
    tenantId: text(value["tenantId"], `items[${index}].tenantId`),
    tenantName: stringValue(value["tenantName"], `items[${index}].tenantName`),
  };
  if (scope === "tenant") {
    const recipient = value["recipient"];
    if (isText(recipient)) return { ...message, recipient };
  }
  return message;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") throw new DashboardResponseError(`${label} must be a string.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (!isText(value)) throw new DashboardResponseError(`${label} must be a non-empty string.`);
  return value;
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
