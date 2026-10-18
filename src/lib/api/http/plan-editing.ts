import type { Channel, Plan, PlanFeatureKey } from "../types.ts";
import { PlanCatalogError, type PlanResponseUpdateRequest } from "./plan-mapper.ts";

const CHANNELS: Channel[] = ["sms", "whatsapp", "email"];
const API_CHANNELS: Record<Channel, string> = {
  sms: "SMS",
  whatsapp: "WHATSAPP",
  email: "EMAIL",
};
const API_FEATURES: Record<PlanFeatureKey, string> = {
  api_access: "API_ACCESS",
  bulk_messaging: "BULK_MESSAGING",
  webhooks: "WEBHOOKS",
  reporting: "REPORTING",
  audit_export: "AUDIT_EXPORT",
  dedicated_sender_identities: "DEDICATED_SENDER_IDENTITIES",
};

export type PlanEditField =
  "name" | "description" | "tpsLimit" | "quotaPolicy" | "features" | `channel:${Channel}`;

export const PLAN_EDIT_FIELDS: readonly PlanEditField[] = [
  "name",
  "description",
  "tpsLimit",
  "quotaPolicy",
  "features",
  "channel:sms",
  "channel:whatsapp",
  "channel:email",
];

export function changedPlanEditFields(before: Plan, after: Plan): PlanEditField[] {
  return PLAN_EDIT_FIELDS.filter(
    (field) => !sameValue(planEditFieldValue(before, field), planEditFieldValue(after, field)),
  );
}

export function findPlanEditConflicts(
  original: Plan,
  draft: Plan,
  current: Plan,
  confirmedValues: Partial<Record<PlanEditField, unknown>> = {},
): PlanEditField[] {
  return PLAN_EDIT_FIELDS.filter((field) => {
    const originalValue = planEditFieldValue(original, field);
    const draftValue = planEditFieldValue(draft, field);
    const currentValue = planEditFieldValue(current, field);
    if (sameValue(originalValue, draftValue)) return false;
    if (Object.hasOwn(confirmedValues, field)) {
      const confirmedValue = confirmedValues[field];
      if (!sameValue(originalValue, confirmedValue)) {
        return !sameValue(currentValue, confirmedValue);
      }
    }
    if (sameValue(originalValue, currentValue)) return false;
    return true;
  });
}

export function mergePlanEditAfterRefresh(original: Plan, draft: Plan, current: Plan): Plan {
  const merged: Plan = {
    ...current,
    entitlements: current.entitlements.map((entitlement) => ({ ...entitlement })),
    features: [...current.features],
  };
  for (const field of PLAN_EDIT_FIELDS) {
    if (!sameValue(planEditFieldValue(original, field), planEditFieldValue(draft, field))) {
      copyPlanEditField(merged, draft, field);
    }
  }
  return merged;
}

export function copyPlanEditFields(
  target: Plan,
  source: Plan,
  fields: readonly PlanEditField[],
): Plan {
  const copied: Plan = {
    ...target,
    entitlements: target.entitlements.map((entitlement) => ({ ...entitlement })),
    features: [...target.features],
  };
  for (const field of fields) copyPlanEditField(copied, source, field);
  return copied;
}

export function planEditFieldValue(plan: Plan, field: PlanEditField): unknown {
  switch (field) {
    case "name":
    case "description":
    case "tpsLimit":
    case "quotaPolicy":
      return plan[field];
    case "features":
      return [...plan.features].sort();
    default: {
      const channel = field.slice("channel:".length) as Channel;
      const entitlement = plan.entitlements.find((item) => item.channel === channel);
      return {
        enabled: entitlement?.enabled ?? false,
        monthly: entitlement?.enabled ? entitlement.monthly : null,
      };
    }
  }
}

export function displayPlanEditFieldValue(plan: Plan, field: PlanEditField): string {
  return displayPlanEditValue(planEditFieldValue(plan, field), field);
}

export function displayPlanEditValue(value: unknown, field: PlanEditField): string {
  if (field === "features") return Array.isArray(value) ? value.join(", ") || "—" : "—";
  if (field.startsWith("channel:")) {
    if (
      typeof value !== "object" ||
      value === null ||
      !("enabled" in value) ||
      !("monthly" in value)
    )
      return "—";
    if (value.enabled !== true && value.enabled !== false) return "—";
    return value.enabled
      ? `enabled; monthly quota ${value.monthly}`
      : "disabled; monthly quota null";
  }
  return String(value);
}

export function createPlanEditRequests(
  planId: string,
  baseline: Plan,
  draft: Plan,
): PlanResponseUpdateRequest[] {
  const path = `/plans/${encodeURIComponent(planId)}`;
  const requests: PlanResponseUpdateRequest[] = [];
  const details: { name?: string; description?: string } = {};
  const detailFields: ("name" | "description")[] = [];
  if (!sameValue(baseline.name, draft.name)) {
    details.name = draft.name;
    detailFields.push("name");
  }
  if (!sameValue(baseline.description, draft.description)) {
    details.description = draft.description;
    detailFields.push("description");
  }
  if (detailFields.length)
    requests.push({ method: "PATCH", path, body: details, fields: detailFields });

  const terms: { defaultTpsLimit?: number; defaultQuotaPolicy?: "HARD_STOP" | "SOFT_CAP" } = {};
  const termFields: ("tpsLimit" | "quotaPolicy")[] = [];
  if (!sameValue(baseline.tpsLimit, draft.tpsLimit)) {
    terms.defaultTpsLimit = draft.tpsLimit;
    termFields.push("tpsLimit");
  }
  if (!sameValue(baseline.quotaPolicy, draft.quotaPolicy)) {
    terms.defaultQuotaPolicy = draft.quotaPolicy === "hard_stop" ? "HARD_STOP" : "SOFT_CAP";
    termFields.push("quotaPolicy");
  }
  if (termFields.length)
    requests.push({
      method: "PUT",
      path: `${path}/commercial-terms`,
      body: terms,
      fields: termFields,
    });

  if (!sameValue(planEditFieldValue(baseline, "features"), planEditFieldValue(draft, "features"))) {
    requests.push({
      method: "PUT",
      path: `${path}/features`,
      body: { features: draft.features.map((feature) => API_FEATURES[feature]) },
      fields: ["features"],
    });
  }

  for (const channel of CHANNELS) {
    const field: PlanEditField = `channel:${channel}`;
    if (sameValue(planEditFieldValue(baseline, field), planEditFieldValue(draft, field))) continue;
    const entitlement = draft.entitlements.find((item) => item.channel === channel);
    const enabled = entitlement?.enabled ?? false;
    requests.push({
      method: "PUT",
      path: `${path}/channels/${API_CHANNELS[channel]}`,
      body: { enabled, monthlyQuota: enabled ? (entitlement?.monthly ?? null) : null },
      fields: [field],
    });
  }
  return requests;
}

export interface PlanUpdateFailureInit {
  original: Plan;
  draft: Plan;
  latest: Plan | null;
  confirmedValues: Partial<Record<PlanEditField, unknown>>;
  reviewRequiredFields?: readonly PlanEditField[];
  failure: unknown;
  refreshFailure?: unknown;
}

export class PlanUpdateError extends Error {
  readonly original: Plan;
  readonly draft: Plan;
  readonly latest: Plan | null;
  readonly confirmedValues: Partial<Record<PlanEditField, unknown>>;
  readonly attemptedFields: PlanEditField[];
  readonly conflicts: PlanEditField[];
  readonly reviewRequiredFields: PlanEditField[];
  readonly failure: unknown;
  readonly refreshFailure: unknown | null;

  constructor(init: PlanUpdateFailureInit) {
    super("The plan update did not complete.");
    this.name = "PlanUpdateError";
    this.original = init.original;
    this.draft = init.draft;
    this.latest = init.latest;
    this.confirmedValues = init.confirmedValues;
    this.attemptedFields = changedPlanEditFields(init.original, init.draft);
    this.reviewRequiredFields = [...new Set(init.reviewRequiredFields ?? [])];
    this.conflicts = [
      ...new Set([
        ...(init.latest
          ? findPlanEditConflicts(init.original, init.draft, init.latest, init.confirmedValues)
          : []),
        ...this.reviewRequiredFields,
      ]),
    ];
    this.failure = init.failure;
    this.refreshFailure = init.refreshFailure ?? null;
  }
}

export async function applyPlanEditRequests(
  baseline: Plan,
  draft: Plan,
  requests: readonly PlanResponseUpdateRequest[],
  send: (request: PlanResponseUpdateRequest) => Promise<Plan>,
  refresh: () => Promise<Plan>,
): Promise<Plan> {
  let latest: Plan;
  try {
    latest = await refresh();
  } catch (failure) {
    throw new PlanUpdateError({
      original: baseline,
      draft,
      latest: null,
      confirmedValues: {},
      failure,
      refreshFailure: failure,
    });
  }

  const confirmedValues: Partial<Record<PlanEditField, unknown>> = {};
  const preflightConflicts = findPlanEditConflicts(baseline, draft, latest);
  if (preflightConflicts.length || latest.status === "archived") {
    throw new PlanUpdateError({
      original: baseline,
      draft,
      latest,
      confirmedValues,
      failure: new PlanCatalogError(
        latest.status === "archived"
          ? "Archived plans cannot be changed."
          : "The plan changed while it was being edited.",
      ),
    });
  }

  const reviewRequiredFields = new Set<PlanEditField>();
  try {
    for (const request of requests) {
      const response = await send(request);
      for (const field of request.fields) {
        const expected = planEditFieldValue(draft, field);
        const returned = planEditFieldValue(response, field);
        if (!sameValue(expected, returned)) {
          throw new PlanCatalogError(`The server response did not confirm ${field}.`);
        }
        confirmedValues[field] = returned;
      }
      for (const field of PLAN_EDIT_FIELDS) {
        if (
          Object.hasOwn(confirmedValues, field) &&
          !sameValue(planEditFieldValue(response, field), confirmedValues[field])
        ) {
          reviewRequiredFields.add(field);
          throw new PlanCatalogError(`The server response no longer confirms ${field}.`);
        }
      }
      latest = response;
    }
    return latest;
  } catch (failure) {
    try {
      latest = await refresh();
    } catch (refreshFailure) {
      throw new PlanUpdateError({
        original: baseline,
        draft,
        latest: null,
        confirmedValues,
        reviewRequiredFields: [...reviewRequiredFields],
        failure,
        refreshFailure,
      });
    }
    throw new PlanUpdateError({
      original: baseline,
      draft,
      latest,
      confirmedValues,
      reviewRequiredFields: [...reviewRequiredFields],
      failure,
    });
  }
}

function copyPlanEditField(target: Plan, source: Plan, field: PlanEditField): void {
  if (field === "features") {
    target.features = [...source.features];
    return;
  }
  if (field.startsWith("channel:")) {
    const channel = field.slice("channel:".length) as Channel;
    const sourceEntitlement = source.entitlements.find((item) => item.channel === channel);
    const index = target.entitlements.findIndex((item) => item.channel === channel);
    const entitlement = {
      channel,
      enabled: sourceEntitlement?.enabled ?? false,
      monthly: sourceEntitlement?.enabled ? sourceEntitlement.monthly : null,
    };
    if (index < 0) target.entitlements.push(entitlement);
    else target.entitlements[index] = entitlement;
    return;
  }
  if (field === "name" || field === "description") target[field] = source[field];
  if (field === "tpsLimit") target.tpsLimit = source.tpsLimit;
  if (field === "quotaPolicy") target.quotaPolicy = source.quotaPolicy;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
