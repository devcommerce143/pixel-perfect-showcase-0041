import type {
  Channel,
  MessageHistoryAttempt,
  MessageHistoryDateRange,
  MessageHistoryDetail,
  MessageHistoryItem,
  MessageHistoryQuery,
  MessageHistoryStatus,
  Paginated,
  PlatformMessageHistoryItem,
} from "../types.ts";

export const MESSAGE_HISTORY_RANGE_MAX_MS = 31 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const CHANNELS: Record<string, Channel> = {
  SMS: "sms",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
};

const STATUSES: Record<string, MessageHistoryStatus> = {
  ACCEPTED: "accepted",
  QUEUED: "queued",
  DISPATCHING: "dispatching",
  SUBMITTED: "submitted",
  FAILED: "failed",
  UNKNOWN: "unknown",
  DELIVERED: "delivered",
  READ: "read",
};

const ATTEMPT_STATES: Record<string, MessageHistoryAttempt["state"]> = {
  SUBMITTING: "submitting",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  UNKNOWN: "unknown",
};

const ATTEMPT_ERROR_CATEGORIES = new Set([
  "CREDENTIAL_UNUSABLE",
  "TENANT_NOT_OPERATIONAL",
  "SENDER_UNAVAILABLE",
  "TEMPLATE_UNVERIFIED",
  "QUOTA",
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMIT",
  "PROVIDER_REJECTED",
  "TIMEOUT",
  "UNKNOWN_OUTCOME",
]);

export class MessageHistoryResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessageHistoryResponseError";
  }
}

export function defaultMessageHistoryDateRange(now = new Date()): MessageHistoryDateRange {
  const through = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(through.getTime() - 30 * DAY_MS);
  return { from: dateInputValue(from), through: dateInputValue(through) };
}

export function buildMessageHistoryQuery(
  range: MessageHistoryDateRange,
  filters: Pick<MessageHistoryQuery, "page" | "pageSize" | "channel" | "status">,
): MessageHistoryQuery {
  const from = parseDateInput(range.from);
  const through = parseDateInput(range.through);
  const acceptedFrom = from.toISOString();
  const acceptedTo = new Date(through.getTime() + DAY_MS).toISOString();
  const span = Date.parse(acceptedTo) - Date.parse(acceptedFrom);
  if (span <= 0 || span > MESSAGE_HISTORY_RANGE_MAX_MS) {
    throw new RangeError("Message history date range must cover no more than 31 days.");
  }
  if (!Number.isInteger(filters.page) || filters.page < 1) {
    throw new RangeError("Message history page must be a positive integer.");
  }
  if (!Number.isInteger(filters.pageSize) || filters.pageSize < 1 || filters.pageSize > 100) {
    throw new RangeError("Message history page size must be between 1 and 100.");
  }
  return {
    acceptedFrom,
    acceptedTo,
    page: filters.page,
    pageSize: filters.pageSize,
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
}

export function messageHistoryListPath(query: MessageHistoryQuery, tenantId?: string): string {
  const queryString = messageHistoryQueryString(query);
  const path = tenantId
    ? `/tenants/${encodeURIComponent(tenantId)}/message-history`
    : "/message-history";
  return `${path}?${queryString}`;
}

export function platformMessageHistoryListPath(query: MessageHistoryQuery): string {
  return `/platform/message-history?${messageHistoryQueryString(query)}`;
}

function messageHistoryQueryString(query: MessageHistoryQuery): string {
  const from = parseTimestamp(query.acceptedFrom, "acceptedFrom");
  const to = parseTimestamp(query.acceptedTo, "acceptedTo");
  if (
    to.getTime() <= from.getTime() ||
    to.getTime() - from.getTime() > MESSAGE_HISTORY_RANGE_MAX_MS
  ) {
    throw new RangeError("Message history date range must cover no more than 31 days.");
  }
  if (!Number.isInteger(query.page) || query.page < 1) {
    throw new RangeError("Message history page must be a positive integer.");
  }
  if (!Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
    throw new RangeError("Message history page size must be between 1 and 100.");
  }
  const params = new URLSearchParams({
    acceptedFrom: query.acceptedFrom,
    acceptedTo: query.acceptedTo,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.channel) params.set("channel", query.channel.toUpperCase());
  if (query.status) params.set("status", query.status.toUpperCase());
  return params.toString();
}

export function messageHistoryDetailPath(messageId: string, tenantId?: string): string {
  const path = tenantId
    ? `/tenants/${encodeURIComponent(tenantId)}/message-history`
    : "/message-history";
  return `${path}/${encodeURIComponent(messageId)}`;
}

export function messageHistoryPageCsv(
  items: (MessageHistoryItem | PlatformMessageHistoryItem)[],
): string {
  const cell = (value: string) => {
    const safe = /^[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const includesTenant = items.some((item) => "tenantId" in item);
  const rows = [
    [
      "id",
      "applicationId",
      ...(includesTenant ? ["tenantName", "tenantId"] : []),
      "channel",
      "status",
      "acceptedAt",
      "queuedAt",
    ],
    ...items.map((item) => [
      item.id,
      item.applicationId,
      ...("tenantId" in item ? [item.tenantName, item.tenantId] : []),
      item.channel,
      item.status,
      item.acceptedAt,
      item.queuedAt ?? "",
    ]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

export function isValidMessageHistoryDateRange(range: MessageHistoryDateRange): boolean {
  try {
    buildMessageHistoryQuery(range, { page: 1, pageSize: 20 });
    return true;
  } catch {
    return false;
  }
}

export function mapMessageHistoryPage(value: unknown): Paginated<MessageHistoryItem> {
  const response = record(value, "Message history response");
  if (!Array.isArray(response["items"])) {
    throw new MessageHistoryResponseError("Message history items must be an array.");
  }
  const page = positiveInteger(response["page"], "page");
  const pageSize = positiveInteger(response["pageSize"], "pageSize");
  const total = nonNegativeInteger(response["total"], "total");
  if (pageSize > 100) {
    throw new MessageHistoryResponseError(
      "Message history pageSize exceeds the supported maximum.",
    );
  }
  return {
    items: response["items"].map(mapMessageHistoryItem),
    page,
    pageSize,
    total,
  };
}

export function mapPlatformMessageHistoryPage(value: unknown): Paginated<PlatformMessageHistoryItem> {
  const response = record(value, "Platform message history response");
  const page = mapMessageHistoryPage(response);
  const rows = response["items"] as unknown[];
  return {
    ...page,
    items: page.items.map((item, index) => {
      const row = record(rows[index], "Platform message history item");
      return {
        ...item,
        tenantId: uuid(row["tenantId"], "tenantId"),
        tenantName: nonEmptyString(row["tenantName"], "tenantName"),
      };
    }),
  };
}

export function mapMessageHistoryDetail(value: unknown): MessageHistoryDetail {
  const response = record(value, "Message history detail");
  if (!Array.isArray(response["attempts"])) {
    throw new MessageHistoryResponseError("Message history attempts must be an array.");
  }
  return {
    ...mapMessageHistoryItem(response),
    senderIdentityId: uuid(response["senderIdentityId"], "senderIdentityId"),
    templateId: nullableUuid(response["templateId"], "templateId"),
    correlationId: nullableString(response["correlationId"], "correlationId"),
    contentPurgedAt: nullableTimestamp(response["contentPurgedAt"], "contentPurgedAt"),
    recipientNormalized: nonEmptyString(response["recipientNormalized"], "recipientNormalized"),
    attempts: response["attempts"].map(mapAttempt),
  };
}

function mapMessageHistoryItem(value: unknown): MessageHistoryItem {
  const item = record(value, "Message history item");
  const channel = CHANNELS[String(item["channel"])];
  const status = STATUSES[String(item["status"])];
  if (!channel) throw new MessageHistoryResponseError("Message history channel is unsupported.");
  if (!status) throw new MessageHistoryResponseError("Message history status is unsupported.");
  return {
    id: uuid(item["id"], "id"),
    applicationId: uuid(item["applicationId"], "applicationId"),
    channel,
    status,
    acceptedAt: timestamp(item["acceptedAt"], "acceptedAt"),
    queuedAt: nullableTimestamp(item["queuedAt"], "queuedAt"),
  };
}

function mapAttempt(value: unknown): MessageHistoryAttempt {
  const attempt = record(value, "Message history attempt");
  const state = ATTEMPT_STATES[String(attempt["state"])];
  const errorCategory = nullableString(attempt["errorCategory"], "errorCategory");
  if (!state)
    throw new MessageHistoryResponseError("Message history attempt state is unsupported.");
  if (errorCategory !== null && !ATTEMPT_ERROR_CATEGORIES.has(errorCategory)) {
    throw new MessageHistoryResponseError("Message history attempt error category is unsupported.");
  }
  return {
    attemptNumber: positiveInteger(attempt["attemptNumber"], "attemptNumber"),
    state,
    errorCategory,
    startedAt: timestamp(attempt["startedAt"], "startedAt"),
    finishedAt: nullableTimestamp(attempt["finishedAt"], "finishedAt"),
  };
}

function parseDateInput(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError("Message history dates must use YYYY-MM-DD.");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || dateInputValue(parsed) !== value) {
    throw new RangeError("Message history date is invalid.");
  }
  return parsed;
}

function parseTimestamp(value: string, name: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new RangeError(`${name} must be a UTC timestamp.`);
  }
  const parsed = new Date(value);
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw new RangeError(`${name} must be a valid UTC timestamp.`);
  }
  return parsed;
}

function dateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MessageHistoryResponseError(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, name: string): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new MessageHistoryResponseError(`${name} must be a UUID.`);
  }
  return value;
}

function nullableUuid(value: unknown, name: string): string | null {
  return value === null ? null : uuid(value, name);
}

function timestamp(value: unknown, name: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
  ) {
    throw new MessageHistoryResponseError(`${name} must be a UTC timestamp.`);
  }
  const parsed = new Date(value);
  const normalized = value.includes(".") ? value : value.replace("Z", ".000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw new MessageHistoryResponseError(`${name} must be a valid UTC timestamp.`);
  }
  return value;
}

function nullableTimestamp(value: unknown, name: string): string | null {
  return value === null ? null : timestamp(value, name);
}

function nullableString(value: unknown, name: string): string | null {
  if (value !== null && typeof value !== "string") {
    throw new MessageHistoryResponseError(`${name} must be a string or null.`);
  }
  return value;
}

function nonEmptyString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MessageHistoryResponseError(`${name} must be a non-empty string.`);
  }
  return value;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new MessageHistoryResponseError(`${name} must be a positive integer.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new MessageHistoryResponseError(`${name} must be a non-negative integer.`);
  }
  return value;
}
