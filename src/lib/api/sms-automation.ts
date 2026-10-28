import type { SenderIdentityActor } from "./types.ts";
export interface SmsAutomationPolicy {
  state: "ENABLED" | "PAUSED" | "DISABLED";
  bulkEnabled: boolean;
  maxSubmissions: number | null;
  validUntil: string | null;
  revision: number;
}
export interface SmsAutomationInput extends Omit<SmsAutomationPolicy, "revision"> {
  expectedRevision: number;
  confirmPendingWork: boolean;
}
export function smsAutomationPath(actor: SenderIdentityActor, tenantId: string) {
  if (
    actor.role !== "super_admin" ||
    !actor.userId ||
    actor.tenantId !== null ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$(?![\s\S])/i.test(tenantId)
  )
    throw new Error("Platform tenant access required");
  return `/tenants/${tenantId}/sms-automation`;
}
export function smsAutomationKey(actor: SenderIdentityActor, tenantId: string) {
  return ["smsAutomation", actor.userId, actor.role, actor.tenantId, "platform", tenantId] as const;
}
export function mapSmsAutomation(value: unknown): SmsAutomationPolicy | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid automation response");
  const r = value as Record<string, unknown>;
  if (
    !["ENABLED", "PAUSED", "DISABLED"].includes(r["state"] as string) ||
    typeof r["bulkEnabled"] !== "boolean" ||
    !(
      r["maxSubmissions"] === null ||
      (Number.isInteger(r["maxSubmissions"]) &&
        (r["maxSubmissions"] as number) >= 1 &&
        (r["maxSubmissions"] as number) <= 20)
    ) ||
    !(
      r["validUntil"] === null ||
      (typeof r["validUntil"] === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$(?![\s\S])/.test(r["validUntil"]) &&
        Number.isFinite(Date.parse(r["validUntil"])))
    ) ||
    !Number.isSafeInteger(r["revision"]) ||
    (r["revision"] as number) < 1
  )
    throw new Error("Invalid automation response");
  return {
    state: r["state"] as SmsAutomationPolicy["state"],
    bulkEnabled: r["bulkEnabled"],
    maxSubmissions: r["maxSubmissions"] as number | null,
    validUntil: r["validUntil"] as string | null,
    revision: r["revision"] as number,
  };
}
export function smsAutomationBody(input: SmsAutomationInput) {
  mapSmsAutomation({ ...input, revision: input.expectedRevision + 1 });
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0 ||
    typeof input.confirmPendingWork !== "boolean" ||
    (input.state === "ENABLED" && !input.confirmPendingWork)
  )
    throw new Error("Automation confirmation required");
  return {
    state: input.state,
    bulkEnabled: input.bulkEnabled,
    maxSubmissions: input.maxSubmissions,
    validUntil: input.validUntil,
    expectedRevision: input.expectedRevision,
    confirmPendingWork: input.confirmPendingWork,
  };
}
