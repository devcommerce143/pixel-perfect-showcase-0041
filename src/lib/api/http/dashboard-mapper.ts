import type { Channel, DashboardSummary } from "../types.ts";
import type { BackendDashboardSummary } from "./dashboard-dto.ts";

export class DashboardResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardResponseError";
  }
}

const CHANNELS = {
  SMS: "sms",
  EMAIL: "email",
  WHATSAPP: "whatsapp",
} as const satisfies Record<string, Channel>;

/**
 * Maps one engine dashboard payload onto the portal summary.
 *
 * Status counts are copied, not rebucketed:
 * - `delivered` is already DELIVERED + READ.
 * - `pending` is already ACCEPTED + QUEUED + DISPATCHING.
 * - `failed` is FAILED only.
 * - `submitted` is SUBMITTED only. It stays out of delivered, pending, and failed.
 * - `unknown` is UNKNOWN only. It stays out of pending and failed.
 * - `total` is the engine total, including submitted and unknown.
 *
 * Delivery rate = delivered / total × 100.
 * The denominator is every message in the window, so SUBMITTED is not treated as delivered.
 * The rate is null when total is 0.
 *
 * `totalDeltaPct` is null. The engine does not send a previous-window comparison.
 *
 * Tenant quota uses the aggregate counter only:
 * used = aggregate.committedCount, limit = aggregate.monthlyQuota.
 * Reserved units are not added, and channel counters are not summed into the aggregate.
 * The quota is omitted unless the scope is tenant and the limit is a finite number greater than 0.
 * A platform summary has no single quota, even if a number is present.
 */
export function mapDashboardSummary(body: unknown): DashboardSummary {
  const summary = readSummary(body);
  const messages = summary.messages;
  const total = count(messages.total, "messages.total");
  const delivered = count(messages.delivered, "messages.delivered");
  const pending = count(messages.pending, "messages.pending");
  const failed = count(messages.failed, "messages.failed");
  const unknown = count(messages.unknown, "messages.unknown");
  const submitted = count(messages.submitted, "messages.submitted");

  return {
    scope: summary.scope,
    kpis: {
      total,
      delivered,
      pending,
      failed,
      unknown,
      submitted,
      deliveryRate: total > 0 ? (delivered / total) * 100 : null,
      totalDeltaPct: null,
    },
    trend: readTrend(summary.trend),
    channels: readChannels(summary.channels),
    quota: readQuota(summary),
  };
}

function readSummary(body: unknown): BackendDashboardSummary {
  if (!isRecord(body)) throw new DashboardResponseError("Dashboard response must be an object.");
  const scope = body["scope"];
  if (scope !== "platform" && scope !== "tenant") {
    throw new DashboardResponseError("Dashboard scope must be platform or tenant.");
  }
  if (!isRecord(body["messages"])) throw new DashboardResponseError("Dashboard messages are missing.");
  if (!Array.isArray(body["trend"])) throw new DashboardResponseError("Dashboard trend must be an array.");
  if (!Array.isArray(body["channels"])) throw new DashboardResponseError("Dashboard channels must be an array.");
  const usage = body["usage"];
  if (!isRecord(usage) || !isRecord(usage["aggregate"])) {
    throw new DashboardResponseError("Dashboard usage aggregate is missing.");
  }
  return body as unknown as BackendDashboardSummary;
}

function readTrend(points: BackendDashboardSummary["trend"]): DashboardSummary["trend"] {
  return points.map((point, index) => {
    if (!isRecord(point) || typeof point.date !== "string" || point.date.trim() === "") {
      throw new DashboardResponseError(`Dashboard trend point ${index} is missing a date.`);
    }
    return {
      date: point.date,
      delivered: count(point.delivered, `trend[${index}].delivered`),
      failed: count(point.failed, `trend[${index}].failed`),
      pending: count(point.pending, `trend[${index}].pending`),
    };
  });
}

function readChannels(rows: BackendDashboardSummary["channels"]): DashboardSummary["channels"] {
  const seen = new Set<Channel>();
  return rows.map((row, index) => {
    if (!isRecord(row) || typeof row.channel !== "string") {
      throw new DashboardResponseError(`Dashboard channel ${index} is missing.`);
    }
    const channel = CHANNELS[row.channel as keyof typeof CHANNELS];
    if (!channel) throw new DashboardResponseError(`Dashboard channel ${row.channel} is not supported.`);
    if (seen.has(channel)) throw new DashboardResponseError(`Dashboard channel ${row.channel} is duplicated.`);
    seen.add(channel);
    return { channel, count: count(row.count, `channels[${index}].count`) };
  });
}

function readQuota(summary: BackendDashboardSummary): DashboardSummary["quota"] {
  const aggregate = summary.usage.aggregate;
  const used = count(aggregate.committedCount, "usage.aggregate.committedCount");
  const limit = readLimit(aggregate.monthlyQuota);
  if (summary.scope === "platform") {
    if (limit !== null) {
      throw new DashboardResponseError("A platform dashboard cannot carry one monthly quota.");
    }
    return null;
  }
  if (limit === null || limit <= 0) return null;
  return { used, limit };
}

function readLimit(value: unknown): number | null {
  if (value === null) return null;
  return count(value, "usage.aggregate.monthlyQuota");
}

function count(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DashboardResponseError(`${label} must be a non-negative finite number.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
