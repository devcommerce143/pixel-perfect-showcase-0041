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

const API_STATUSES = {
  draft: "DRAFT",
  active: "ACTIVE",
} as const satisfies Record<"draft" | "active", string>;

const API_POLICIES = {
  hard_stop: "HARD_STOP",
  soft_cap: "SOFT_CAP",
} as const satisfies Record<QuotaPolicy, string>;

const API_FEATURES = {
  api_access: "API_ACCESS",
  bulk_messaging: "BULK_MESSAGING",
  webhooks: "WEBHOOKS",
  reporting: "REPORTING",
  audit_export: "AUDIT_EXPORT",
  dedicated_sender_identities: "DEDICATED_SENDER_IDENTITIES",
} as const satisfies Record<PlanFeatureKey, string>;

const API_CHANNELS = {
  sms: "SMS",
  email: "EMAIL",
  whatsapp: "WHATSAPP",
} as const satisfies Record<Channel, string>;

export interface CreatePlanRequest {
  code: string;
  name: string;
  description: string;
  status: (typeof API_STATUSES)[keyof typeof API_STATUSES];
  defaultTpsLimit: number;
  defaultQuotaPolicy: (typeof API_POLICIES)[QuotaPolicy];
  features: (typeof API_FEATURES)[PlanFeatureKey][];
  channels: {
    channel: (typeof API_CHANNELS)[Channel];
    enabled: boolean;
    monthlyQuota: number | null;
  }[];
}

export type PlanResponseUpdateRequest =
  | { method: "PATCH"; path: string; body: { name?: string; description?: string }; fields: ("name" | "description")[] }
  | { method: "PUT"; path: string; body: { defaultTpsLimit?: number; defaultQuotaPolicy?: "HARD_STOP" | "SOFT_CAP" }; fields: ("tpsLimit" | "quotaPolicy")[] }
  | { method: "PUT"; path: string; body: { features: string[] }; fields: "features"[] }
  | { method: "PUT"; path: string; body: { enabled: boolean; monthlyQuota: number | null }; fields: `channel:${Channel}`[] };

export type LiveCreatePlanInput = Omit<Plan, "id" | "tenants" | "status"> & {
  status: keyof typeof API_STATUSES;
};

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

/** Maps the frontend plan draft to the backend CreatePlanDto shape. */
export function toCreatePlanRequest(input: LiveCreatePlanInput): CreatePlanRequest {
  return {
    code: input.code,
    name: input.name,
    description: input.description,
    status: API_STATUSES[input.status],
    defaultTpsLimit: input.tpsLimit,
    defaultQuotaPolicy: API_POLICIES[input.quotaPolicy],
    features: input.features.map((feature) => API_FEATURES[feature]),
    channels: input.entitlements.map((entitlement) => ({
      channel: API_CHANNELS[entitlement.channel],
      enabled: entitlement.enabled,
      monthlyQuota: entitlement.enabled ? entitlement.monthly : null,
    })),
  };
}

/** Maps the PlanResponseDto returned by POST /plans. */
export function mapPlanResponse(body: unknown): Plan {
  return readPlan(body, 0);
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
