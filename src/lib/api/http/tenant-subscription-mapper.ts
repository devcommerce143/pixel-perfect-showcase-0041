import type {
  Channel,
  EntitlementBlocker,
  EntitlementValueSource,
  PlanFeatureKey,
  QuotaPolicy,
  ResolvedTenantChannel,
  ResolvedTenantEntitlements,
  SubscriptionRecordStatus,
  TenantPlanAssignmentInput,
  TenantPlanAssignmentResult,
  TenantSubscriptionChannelOverrideInput,
  TenantSubscriptionHistoryPage,
  TenantSubscriptionHistoryQuery,
  TenantSubscriptionOverridesInput,
  TenantStatus,
  TenantSubscriptionRecord,
  TenantSubscriptionView,
} from "../types.ts";
import { mapPlanResponse } from "./plan-mapper.ts";
import { isIsoTimestamp, isTenantUuid } from "./tenant-mapper.ts";

const CHANNELS = {
  SMS: "sms",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
} as const satisfies Record<string, Channel>;

const TENANT_STATUSES = {
  TRIAL: "trial",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  INACTIVE: "inactive",
} as const satisfies Record<string, TenantStatus>;

const SUBSCRIPTION_STATUSES = {
  TRIAL: "trial",
  ACTIVE: "active",
  PENDING: "pending",
} as const satisfies Record<string, SubscriptionRecordStatus>;
const HISTORY_SUBSCRIPTION_STATUSES = {
  ...SUBSCRIPTION_STATUSES,
  CANCELLED: "cancelled",
} as const satisfies Record<string, SubscriptionRecordStatus>;

const QUOTA_POLICIES = {
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

const VALUE_SOURCES = ["plan", "subscription", "channel", "unavailable"] as const satisfies readonly EntitlementValueSource[];
const BLOCKERS = [
  "TENANT_SUSPENDED",
  "TENANT_INACTIVE",
  "SUBSCRIPTION_MISSING",
  "SUBSCRIPTION_PENDING",
  "SUBSCRIPTION_CANCELLED",
  "SUBSCRIPTION_NOT_STARTED",
  "SUBSCRIPTION_ENDED",
] as const satisfies readonly EntitlementBlocker[];

export class TenantSubscriptionResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantSubscriptionResponseError";
  }
}

export function tenantSubscriptionPath(tenantId: string): string {
  return `/tenants/${encodeURIComponent(tenantId)}/subscription`;
}

export function tenantSubscriptionHistoryPath(
  tenantId: string,
  query: TenantSubscriptionHistoryQuery,
): string {
  requireTenantId(tenantId);
  if (!Number.isSafeInteger(query.page) || query.page < 1) {
    throw new TenantSubscriptionRequestError("History page must be a positive integer.");
  }
  if (!Number.isSafeInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
    throw new TenantSubscriptionRequestError("History page size must be between 1 and 100.");
  }
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  return `${tenantSubscriptionPath(tenantId)}/history?${params}`;
}

export function tenantSubscriptionOverridesPath(tenantId: string): string {
  requireTenantId(tenantId);
  return `${tenantSubscriptionPath(tenantId)}/overrides`;
}

export function tenantSubscriptionChannelPath(tenantId: string, channel: Channel): string {
  requireTenantId(tenantId);
  return `${tenantSubscriptionPath(tenantId)}/channels/${channel.toUpperCase()}`;
}

export function tenantSubscriptionCancelPath(tenantId: string): string {
  requireTenantId(tenantId);
  return `${tenantSubscriptionPath(tenantId)}/cancel`;
}
export class TenantPlanAssignmentRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantPlanAssignmentRequestError";
  }
}

export class TenantSubscriptionRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantSubscriptionRequestError";
  }
}

function requireTenantId(tenantId: string): void {
  if (!isTenantUuid(tenantId)) {
    throw new TenantSubscriptionRequestError("Tenant ID must be a UUID.");
  }
}
export function tenantPlanAssignmentPath(tenantId: string): string {
  if (!isTenantUuid(tenantId)) {
    throw new TenantPlanAssignmentRequestError("Tenant ID must be a UUID.");
  }
  return tenantSubscriptionPath(tenantId);
}

export function toTenantPlanAssignmentRequest(
  input: TenantPlanAssignmentInput,
): { planId: string; status: "TRIAL" | "ACTIVE" } {
  if (!isTenantUuid(input.planId)) {
    throw new TenantPlanAssignmentRequestError("Plan ID must be a UUID.");
  }
  if (input.status !== "trial" && input.status !== "active") {
    throw new TenantPlanAssignmentRequestError("Subscription status must be trial or active.");
  }
  return {
    planId: input.planId,
    status: input.status === "trial" ? "TRIAL" : "ACTIVE",
  };
}

export function toTenantSubscriptionOverridesRequest(input: TenantSubscriptionOverridesInput): {
  tpsLimitOverride?: number | null;
  quotaPolicyOverride?: "HARD_STOP" | "SOFT_CAP" | null;
} {
  if (input.tpsLimitOverride === undefined && input.quotaPolicyOverride === undefined) {
    throw new TenantSubscriptionRequestError("At least one subscription override is required.");
  }
  if (
    input.tpsLimitOverride !== undefined &&
    input.tpsLimitOverride !== null &&
    (!Number.isSafeInteger(input.tpsLimitOverride) || input.tpsLimitOverride < 1)
  ) {
    throw new TenantSubscriptionRequestError("TPS override must be a positive integer or null.");
  }
  if (
    input.quotaPolicyOverride !== undefined &&
    input.quotaPolicyOverride !== null &&
    input.quotaPolicyOverride !== "hard_stop" &&
    input.quotaPolicyOverride !== "soft_cap"
  ) {
    throw new TenantSubscriptionRequestError("Quota policy override is unsupported.");
  }
  return {
    ...(input.tpsLimitOverride !== undefined ? { tpsLimitOverride: input.tpsLimitOverride } : {}),
    ...(input.quotaPolicyOverride !== undefined
      ? {
          quotaPolicyOverride:
            input.quotaPolicyOverride === null
              ? null
              : (input.quotaPolicyOverride.toUpperCase() as "HARD_STOP" | "SOFT_CAP"),
        }
      : {}),
  };
}

export function toTenantSubscriptionChannelOverrideRequest(
  input: TenantSubscriptionChannelOverrideInput,
): TenantSubscriptionChannelOverrideInput {
  if (
    input.enabledOverride === undefined &&
    input.monthlyQuotaOverride === undefined &&
    input.tpsOverride === undefined
  ) {
    throw new TenantSubscriptionRequestError("At least one channel override is required.");
  }
  if (
    input.monthlyQuotaOverride !== undefined &&
    input.monthlyQuotaOverride !== null &&
    (!Number.isSafeInteger(input.monthlyQuotaOverride) || input.monthlyQuotaOverride < 0)
  ) {
    throw new TenantSubscriptionRequestError(
      "Monthly quota override must be a non-negative integer or null.",
    );
  }
  if (
    input.tpsOverride !== undefined &&
    input.tpsOverride !== null &&
    (!Number.isSafeInteger(input.tpsOverride) || input.tpsOverride < 1)
  ) {
    throw new TenantSubscriptionRequestError(
      "Channel TPS override must be a positive integer or null.",
    );
  }
  if (
    input.enabledOverride !== undefined &&
    input.enabledOverride !== null &&
    typeof input.enabledOverride !== "boolean"
  ) {
    throw new TenantSubscriptionRequestError("Channel enabled override must be boolean or null.");
  }
  return { ...input };
}

export function tenantSubscriptionQueryKey(tenantId: string) {
  return ["tenants", "subscription", tenantId] as const;
}

export function tenantSubscriptionHistoryQueryKey(
  tenantId: string,
  query: TenantSubscriptionHistoryQuery,
) {
  return ["tenants", "subscription-history", tenantId, query.page, query.pageSize] as const;
}
export function mapTenantPlanAssignmentResponse(
  body: unknown,
  tenantId: string,
  input: TenantPlanAssignmentInput,
): TenantPlanAssignmentResult {
  const view = mapTenantSubscriptionView(body, tenantId);
  const subscription = view.subscription;
  if (!subscription) {
    throw new TenantSubscriptionResponseError("Plan assignment response must contain a subscription.");
  }
  if (subscription.planId !== input.planId) {
    throw new TenantSubscriptionResponseError("Plan assignment response does not match the requested plan.");
  }
  if (subscription.status !== input.status) {
    throw new TenantSubscriptionResponseError("Plan assignment response does not match the requested status.");
  }
  return { ...view, subscription };
}

export function mapTenantSubscriptionView(body: unknown, expectedTenantId?: string): TenantSubscriptionView {
  if (!isRecord(body)) throw new TenantSubscriptionResponseError("Tenant subscription response must be an object.");
  const subscription = body["subscription"] === null
    ? null
    : readSubscription(body["subscription"]);
  const effective = readEffective(body["effective"]);
  if (expectedTenantId && effective.tenantId !== expectedTenantId) {
    throw new TenantSubscriptionResponseError("Effective entitlements belong to a different tenant.");
  }
  if (subscription && subscription.tenantId !== effective.tenantId) {
    throw new TenantSubscriptionResponseError("Subscription belongs to a different tenant.");
  }
  if (subscription && (effective.subscriptionId !== subscription.id || effective.planId !== subscription.planId)) {
    throw new TenantSubscriptionResponseError("Subscription and effective entitlement references do not match.");
  }
  if (!subscription && (effective.subscriptionId !== null || effective.planId !== null)) {
    throw new TenantSubscriptionResponseError("A missing subscription cannot have subscription or plan references.");
  }
  if (!subscription) validateMissingSubscriptionEntitlements(effective);
  return { subscription, effective };
}

export function mapTenantSubscriptionHistoryPage(
  body: unknown,
  expectedTenantId: string,
): TenantSubscriptionHistoryPage {
  if (!isRecord(body))
    throw new TenantSubscriptionResponseError("Subscription history response must be an object.");
  const page = positiveInteger(body["page"], "history.page");
  const pageSize = positiveInteger(body["pageSize"], "history.pageSize");
  if (pageSize > 100)
    throw new TenantSubscriptionResponseError("history.pageSize cannot exceed 100.");
  const total = nonNegativeInteger(body["total"], "history.total");
  if (!Array.isArray(body["items"]))
    throw new TenantSubscriptionResponseError("history.items must be an array.");
  const items = body["items"].map((item, index) => readHistorySubscription(item, index));
  if (items.some((item) => item.tenantId !== expectedTenantId)) {
    throw new TenantSubscriptionResponseError(
      "Subscription history contains a record for a different tenant.",
    );
  }
  return { items, page, pageSize, total };
}

function readHistorySubscription(value: unknown, index: number): TenantSubscriptionRecord {
  if (!isRecord(value))
    throw new TenantSubscriptionResponseError(`history.items[${index}] must be an object.`);
  const statusText = text(value["status"], `history.items[${index}].status`);
  const status =
    HISTORY_SUBSCRIPTION_STATUSES[statusText as keyof typeof HISTORY_SUBSCRIPTION_STATUSES];
  if (!status)
    throw new TenantSubscriptionResponseError(`history.items[${index}].status is unknown.`);
  return readSubscriptionRecord(value, status);
}
function validateMissingSubscriptionEntitlements(effective: ResolvedTenantEntitlements): void {
  const channelsUnavailable = effective.channels.every((channel) =>
    !channel.enabled &&
    channel.monthlyQuota === null &&
    channel.tpsLimit === null &&
    channel.quotaSource === "unavailable" &&
    channel.tpsSource === "unavailable" &&
    !channel.ignoredOverride,
  );
  if (
    effective.configured ||
    effective.operational ||
    !effective.blockers.includes("SUBSCRIPTION_MISSING") ||
    effective.quotaPolicy !== null ||
    effective.quotaPolicySource !== null ||
    effective.tpsLimit !== null ||
    effective.tpsSource !== null ||
    effective.features.length !== 0 ||
    !channelsUnavailable
  ) {
    throw new TenantSubscriptionResponseError("Effective entitlements are inconsistent with a missing subscription.");
  }
}

function readSubscription(value: unknown): TenantSubscriptionRecord {
  if (!isRecord(value))
    throw new TenantSubscriptionResponseError("Subscription must be an object or null.");
  const statusText = text(value["status"], "subscription.status");
  const status = SUBSCRIPTION_STATUSES[statusText as keyof typeof SUBSCRIPTION_STATUSES];
  if (!status) throw new TenantSubscriptionResponseError("Subscription has an unknown status.");
  return readSubscriptionRecord(value, status);
}

function readSubscriptionRecord(
  value: Record<string, unknown>,
  status: SubscriptionRecordStatus,
): TenantSubscriptionRecord {
  const plan = mapPlanResponse(value["plan"]);
  const id = uuid(value["id"], "subscription.id");
  const tenantId = uuid(value["tenantId"], "subscription.tenantId");
  const planId = uuid(value["planId"], "subscription.planId");
  if (plan.id !== planId)
    throw new TenantSubscriptionResponseError("Subscription plan ID does not match its plan.");
  const rawOverrides = value["channelOverrides"];
  if (!Array.isArray(rawOverrides))
    throw new TenantSubscriptionResponseError("Subscription channel overrides must be an array.");
  const seen = new Set<Channel>();
  const channelOverrides = rawOverrides.map((item, index) => {
    if (!isRecord(item))
      throw new TenantSubscriptionResponseError(
        `Subscription channel override ${index} must be an object.`,
      );
    const channel = readChannel(item["channel"], `subscription.channelOverrides[${index}].channel`);
    if (seen.has(channel))
      throw new TenantSubscriptionResponseError(`Subscription repeats the ${channel} override.`);
    seen.add(channel);
    return {
      channel,
      enabledOverride: nullableBoolean(
        item["enabledOverride"],
        `subscription.channelOverrides[${index}].enabledOverride`,
      ),
      monthlyQuotaOverride: nullableInteger(
        item["monthlyQuotaOverride"],
        `subscription.channelOverrides[${index}].monthlyQuotaOverride`,
        0,
      ),
      tpsOverride: nullableInteger(
        item["tpsOverride"],
        `subscription.channelOverrides[${index}].tpsOverride`,
        1,
      ),
    };
  });
  const quotaPolicy = nullableQuotaPolicy(
    value["quotaPolicyOverride"],
    "subscription.quotaPolicyOverride",
  );
  return {
    id,
    tenantId,
    planId,
    status,
    startsAt: timestamp(value["startsAt"], "subscription.startsAt"),
    endsAt: value["endsAt"] === null ? null : timestamp(value["endsAt"], "subscription.endsAt"),
    tpsLimitOverride: nullableInteger(
      value["tpsLimitOverride"],
      "subscription.tpsLimitOverride",
      1,
    ),
    quotaPolicyOverride: quotaPolicy,
    channelOverrides,
    plan,
    createdAt: timestamp(value["createdAt"], "subscription.createdAt"),
    updatedAt: timestamp(value["updatedAt"], "subscription.updatedAt"),
  };
}
function readEffective(value: unknown): ResolvedTenantEntitlements {
  if (!isRecord(value)) throw new TenantSubscriptionResponseError("Effective entitlements must be an object.");
  const features = array(value["features"], "effective.features").map((feature, index) => {
    const code = text(feature, `effective.features[${index}]`);
    const mapped = FEATURES[code as keyof typeof FEATURES];
    if (!mapped) throw new TenantSubscriptionResponseError(`Effective feature ${index} is unknown.`);
    return mapped;
  });
  if (new Set(features).size !== features.length) {
    throw new TenantSubscriptionResponseError("Effective entitlements contain duplicate features.");
  }
  const channels = array(value["channels"], "effective.channels").map(readResolvedChannel);
  const channelCodes = new Set(channels.map((channel) => channel.channel));
  if (channels.length !== 3 || channelCodes.size !== 3) {
    throw new TenantSubscriptionResponseError("Effective entitlements must contain each channel exactly once.");
  }
  const quotaPolicySource = sourceOrNull(value["quotaPolicySource"], "effective.quotaPolicySource", ["plan", "subscription"]);
  const tpsSource = sourceOrNull(value["tpsSource"], "effective.tpsSource", ["plan", "subscription"]);
  return {
    tenantId: uuid(value["tenantId"], "effective.tenantId"),
    tenantStatus: readTenantStatus(value["tenantStatus"]),
    subscriptionId: nullableUuid(value["subscriptionId"], "effective.subscriptionId"),
    planId: nullableUuid(value["planId"], "effective.planId"),
    configured: boolean(value["configured"], "effective.configured"),
    operational: boolean(value["operational"], "effective.operational"),
    blockers: array(value["blockers"], "effective.blockers").map((blocker, index) => {
      if (typeof blocker !== "string" || !BLOCKERS.includes(blocker as EntitlementBlocker)) {
        throw new TenantSubscriptionResponseError(`Effective blocker ${index} is unknown.`);
      }
      return blocker as EntitlementBlocker;
    }),
    quotaPolicy: nullableQuotaPolicy(value["quotaPolicy"], "effective.quotaPolicy"),
    quotaPolicySource,
    tpsLimit: nullableInteger(value["tpsLimit"], "effective.tpsLimit", 1),
    tpsSource,
    features,
    channels,
  };
}

function readResolvedChannel(value: unknown, index: number): ResolvedTenantChannel {
  const field = `effective.channels[${index}]`;
  if (!isRecord(value)) throw new TenantSubscriptionResponseError(`${field} must be an object.`);
  return {
    channel: readChannel(value["channel"], `${field}.channel`),
    enabled: boolean(value["enabled"], `${field}.enabled`),
    monthlyQuota: nullableInteger(value["monthlyQuota"], `${field}.monthlyQuota`, 0),
    tpsLimit: nullableInteger(value["tpsLimit"], `${field}.tpsLimit`, 1),
    quotaSource: valueSource(value["quotaSource"], `${field}.quotaSource`),
    tpsSource: valueSource(value["tpsSource"], `${field}.tpsSource`),
    ignoredOverride: boolean(value["ignoredOverride"], `${field}.ignoredOverride`),
  };
}

function readChannel(value: unknown, field: string): Channel {
  const code = text(value, field);
  const channel = CHANNELS[code as keyof typeof CHANNELS];
  if (!channel) throw new TenantSubscriptionResponseError(`${field} is unknown.`);
  return channel;
}

function readTenantStatus(value: unknown): TenantStatus {
  const code = text(value, "effective.tenantStatus");
  const status = TENANT_STATUSES[code as keyof typeof TENANT_STATUSES];
  if (!status) throw new TenantSubscriptionResponseError("Effective tenant status is unknown.");
  return status;
}

function valueSource(value: unknown, field: string): EntitlementValueSource {
  if (typeof value !== "string" || !VALUE_SOURCES.includes(value as EntitlementValueSource)) {
    throw new TenantSubscriptionResponseError(`${field} is unknown.`);
  }
  return value as EntitlementValueSource;
}

function sourceOrNull(value: unknown, field: string, allowed: readonly string[]): "plan" | "subscription" | null {
  if (value === null) return null;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new TenantSubscriptionResponseError(`${field} is unknown.`);
  }
  return value as "plan" | "subscription";
}

function nullableQuotaPolicy(value: unknown, field: string): QuotaPolicy | null {
  if (value === null) return null;
  const code = text(value, field);
  const policy = QUOTA_POLICIES[code as keyof typeof QUOTA_POLICIES];
  if (!policy) throw new TenantSubscriptionResponseError(`${field} is unknown.`);
  return policy;
}

function nullableUuid(value: unknown, field: string): string | null {
  if (value === null) return null;
  return uuid(value, field);
}

function uuid(value: unknown, field: string): string {
  const result = text(value, field);
  if (!isTenantUuid(result)) throw new TenantSubscriptionResponseError(`${field} must be a UUID.`);
  return result;
}

function timestamp(value: unknown, field: string): string {
  if (!isIsoTimestamp(value)) throw new TenantSubscriptionResponseError(`${field} must be a valid timestamp.`);
  return value;
}

function nullableBoolean(value: unknown, field: string): boolean | null {
  if (value === null) return null;
  return boolean(value, field);
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new TenantSubscriptionResponseError(`${field} must be a boolean.`);
  return value;
}

function nullableInteger(value: unknown, field: string, minimum: number): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new TenantSubscriptionResponseError(`${field} must be an integer of at least ${minimum} or null.`);
  }
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TenantSubscriptionResponseError(`${field} must be text.`);
  }
  return value;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new TenantSubscriptionResponseError(`${field} must be an array.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new TenantSubscriptionResponseError(`${field} must be a positive integer.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TenantSubscriptionResponseError(`${field} must be a non-negative integer.`);
  }
  return value;
}
