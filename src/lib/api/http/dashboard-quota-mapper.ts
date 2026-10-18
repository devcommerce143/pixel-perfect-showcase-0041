import type { Channel, DashboardQuotaChannel, DashboardQuotaWarning, QuotaUsageReading, QuotaWarningBand } from "../types.ts";
import { DashboardResponseError } from "./dashboard-mapper.ts";

const CHANNELS = {
  SMS: "sms",
  EMAIL: "email",
  WHATSAPP: "whatsapp",
} as const satisfies Record<string, Channel>;

const POLICIES = {
  HARD_STOP: "hard_stop",
  SOFT_CAP: "soft_cap",
} as const;

/**
 * Maps the engine quota assessment.
 * `used`, `band`, and `overage` are copied. They are not recomputed, clamped,
 * or added across the aggregate and channel counters.
 */
export function mapDashboardQuota(body: unknown): DashboardQuotaWarning {
  if (!isRecord(body)) throw new DashboardResponseError("Dashboard quota response must be an object.");
  const scope = body["scope"];
  const periodStart = dateText(body["periodStart"], "periodStart");
  if (scope === "platform") return readPlatform(body, periodStart);
  if (scope === "tenant") return readTenant(body, periodStart);
  throw new DashboardResponseError("Dashboard quota scope must be platform or tenant.");
}

function readPlatform(body: Record<string, unknown>, periodStart: string): DashboardQuotaWarning {
  if (body["tenantId"] !== null) {
    throw new DashboardResponseError("A platform quota response cannot name one tenant.");
  }
  if (!isRecord(body["counts"])) throw new DashboardResponseError("Dashboard quota counts are missing.");
  const counts = body["counts"];
  return {
    scope: "platform",
    tenantId: null,
    periodStart,
    counts: {
      atOrAbove80: count(counts["atOrAbove80"], "counts.atOrAbove80"),
      atOrAbove90: count(counts["atOrAbove90"], "counts.atOrAbove90"),
      atOrAbove100: count(counts["atOrAbove100"], "counts.atOrAbove100"),
      unconfigured: count(counts["unconfigured"], "counts.unconfigured"),
    },
  };
}

function readTenant(body: Record<string, unknown>, periodStart: string): DashboardQuotaWarning {
  const tenantId = text(body["tenantId"], "tenantId");
  if (typeof body["configured"] !== "boolean") {
    throw new DashboardResponseError("Dashboard quota configured must be a boolean.");
  }
  const policy = readPolicy(body["policy"]);
  const policySource = readPolicySource(body["policySource"]);
  if ((policy === null) !== (policySource === null)) {
    throw new DashboardResponseError("Dashboard quota policy and policy source must both be present or both be null.");
  }
  if (!Array.isArray(body["channels"])) throw new DashboardResponseError("Dashboard quota channels must be an array.");
  const seen = new Set<Channel>();
  return {
    scope: "tenant",
    tenantId,
    periodStart,
    configured: body["configured"],
    policy,
    policySource,
    aggregate: readReading(body["aggregate"], "aggregate"),
    channels: body["channels"].map((channel, index) => {
      const mapped = readChannel(channel, index);
      if (seen.has(mapped.channel)) {
        throw new DashboardResponseError(`Dashboard quota channel ${mapped.channel} is duplicated.`);
      }
      seen.add(mapped.channel);
      return mapped;
    }),
  };
}

function readChannel(value: unknown, index: number): DashboardQuotaChannel {
  if (!isRecord(value) || typeof value["channel"] !== "string") {
    throw new DashboardResponseError(`Dashboard quota channel ${index} is missing.`);
  }
  const channel = CHANNELS[value["channel"] as keyof typeof CHANNELS];
  if (!channel) throw new DashboardResponseError(`Dashboard quota channel ${value["channel"]} is not supported.`);
  if (typeof value["enabled"] !== "boolean") {
    throw new DashboardResponseError(`channels[${index}].enabled must be a boolean.`);
  }
  return { channel, enabled: value["enabled"], ...readReading(value, `channels[${index}]`) };
}

function readReading(value: unknown, label: string): QuotaUsageReading {
  if (!isRecord(value)) throw new DashboardResponseError(`${label} must be an object.`);
  const ceiling = nullableCount(value["ceiling"], `${label}.ceiling`);
  const overage = nullableCount(value["overage"], `${label}.overage`);
  if ((ceiling === null) !== (overage === null)) {
    throw new DashboardResponseError(`${label} ceiling and overage must both be present or both be null.`);
  }
  const band = readBand(value["band"], label);
  return {
    committed: count(value["committed"], `${label}.committed`),
    reserved: count(value["reserved"], `${label}.reserved`),
    used: count(value["used"], `${label}.used`),
    ceiling,
    band,
    overage,
  };
}

function readBand(value: unknown, label: string): QuotaWarningBand {
  if (value === "NONE") return "none";
  if (value === "80" || value === "90" || value === "100") return value;
  throw new DashboardResponseError(`${label}.band is not supported.`);
}

function readPolicy(value: unknown): "hard_stop" | "soft_cap" | null {
  if (value === null) return null;
  if (value === "HARD_STOP") return POLICIES.HARD_STOP;
  if (value === "SOFT_CAP") return POLICIES.SOFT_CAP;
  throw new DashboardResponseError("Dashboard quota policy is not supported.");
}

function readPolicySource(value: unknown): "plan" | "subscription" | null {
  if (value === null) return null;
  if (value === "plan" || value === "subscription") return value;
  throw new DashboardResponseError("Dashboard quota policy source is not supported.");
}

function dateText(value: unknown, label: string): string {
  const date = text(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new DashboardResponseError(`${label} must be a calendar date.`);
  }
  return date;
}

function nullableCount(value: unknown, label: string): number | null {
  if (value === null) return null;
  return count(value, label);
}

function count(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DashboardResponseError(`${label} must be a non-negative finite number.`);
  }
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DashboardResponseError(`${label} must be a non-empty string.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
