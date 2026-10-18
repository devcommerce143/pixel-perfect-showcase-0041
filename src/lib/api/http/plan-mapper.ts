import type { Channel, Paginated, Plan, PlanFeatureKey, QuotaPolicy } from "../types.ts";

export class PlanCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanCatalogError";
  }
}

const STATUSES = {
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived",
} as const satisfies Record<string, Plan["status"]>;

const POLICIES = {
  HARD_STOP: "hard_stop",
  SOFT_CAP: "soft_cap",
} as const satisfies Record<string, QuotaPolicy>;

const FEATURES = {
  API_ACCESS: "api_access",
  BULK_MESSAGING: "bulk_messaging",
  WEBHOOKS: "webhooks",
  REPORTING: "reporting",
  AUDIT_EXPORT: "audit_export",
  DEDICATED_SENDER_IDENTITIES: "dedicated_sender_identities",
} as const satisfies Record<string, PlanFeatureKey>;

const CHANNELS = {
  SMS: "sms",
  EMAIL: "email",
  WHATSAPP: "whatsapp",
} as const satisfies Record<string, Channel>;

/**
 * Maps GET /plans.
 * Status, TPS, quota policy, features, and channel quotas are copied.
 * A disabled channel keeps a null quota. No subscriber count is added.
 */
export function mapPlanPage(body: unknown): Paginated<Plan> {
  if (!isRecord(body)) throw new PlanCatalogError("Plan catalog response must be an object.");
  if (!Array.isArray(body["items"])) throw new PlanCatalogError("Plan catalog items must be an array.");
  return {
    items: body["items"].map((item, index) => readPlan(item, index)),
    page: pageNumber(body["page"], "page"),
    pageSize: pageNumber(body["pageSize"], "pageSize"),
    total: pageNumber(body["total"], "total"),
  };
}

function readPlan(value: unknown, index: number): Plan {
  if (!isRecord(value)) throw new PlanCatalogError(`Plan ${index} must be an object.`);
  const status = STATUSES[text(value["status"], `plans[${index}].status`) as keyof typeof STATUSES];
  if (!status) throw new PlanCatalogError(`Plan ${index} has an unknown status.`);
  const quotaPolicy = POLICIES[text(value["defaultQuotaPolicy"], `plans[${index}].defaultQuotaPolicy`) as keyof typeof POLICIES];
  if (!quotaPolicy) throw new PlanCatalogError(`Plan ${index} has an unknown quota policy.`);
  if (!Array.isArray(value["features"])) throw new PlanCatalogError(`Plan ${index} features must be an array.`);
  if (!Array.isArray(value["channels"])) throw new PlanCatalogError(`Plan ${index} channels must be an array.`);
  const seen = new Set<Channel>();
  return {
    id: text(value["id"], `plans[${index}].id`),
    code: text(value["code"], `plans[${index}].code`),
    name: text(value["name"], `plans[${index}].name`),
    description: value["description"] == null ? "" : text(value["description"], `plans[${index}].description`),
    status,
    tpsLimit: positiveInt(value["defaultTpsLimit"], `plans[${index}].defaultTpsLimit`),
    tenants: null,
    quotaPolicy,
    features: value["features"].map((feature, featureIndex) => readFeature(feature, index, featureIndex)),
    entitlements: value["channels"].map((channel, channelIndex) => {
      const mapped = readChannel(channel, index, channelIndex);
      if (seen.has(mapped.channel)) throw new PlanCatalogError(`Plan ${index} repeats channel ${mapped.channel}.`);
      seen.add(mapped.channel);
      return mapped;
    }),
  };
}

function readFeature(value: unknown, planIndex: number, featureIndex: number): PlanFeatureKey {
  const feature = FEATURES[text(value, `plans[${planIndex}].features[${featureIndex}]`) as keyof typeof FEATURES];
  if (!feature) throw new PlanCatalogError(`Plan ${planIndex} has an unknown feature.`);
  return feature;
}

function readChannel(value: unknown, planIndex: number, channelIndex: number): Plan["entitlements"][number] {
  if (!isRecord(value)) throw new PlanCatalogError(`Plan ${planIndex} channel ${channelIndex} must be an object.`);
  const channel = CHANNELS[text(value["channel"], `plans[${planIndex}].channels[${channelIndex}].channel`) as keyof typeof CHANNELS];
  if (!channel) throw new PlanCatalogError(`Plan ${planIndex} has an unknown channel.`);
  if (typeof value["enabled"] !== "boolean") {
    throw new PlanCatalogError(`Plan ${planIndex} channel ${channel} enabled must be a boolean.`);
  }
  const monthly = readQuota(value["monthlyQuota"], planIndex, channel, value["enabled"]);
  return { channel, enabled: value["enabled"], monthly };
}

function readQuota(value: unknown, planIndex: number, channel: Channel, enabled: boolean): number | null {
  if (!enabled) {
    if (value !== null) throw new PlanCatalogError(`Plan ${planIndex} disabled channel ${channel} must have a null quota.`);
    return null;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new PlanCatalogError(`Plan ${planIndex} channel ${channel} quota must be a non-negative integer.`);
  }
  return value;
}

function pageNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new PlanCatalogError(`Plan catalog ${field} must be a non-negative integer.`);
  }
  if (field !== "total" && value < 1) throw new PlanCatalogError(`Plan catalog ${field} must be at least 1.`);
  return value;
}

function positiveInt(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new PlanCatalogError(`${field} must be a positive integer.`);
  }
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new PlanCatalogError(`${field} must be text.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
