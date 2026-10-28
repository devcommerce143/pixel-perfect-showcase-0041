import type { SenderIdentityActor } from "./types.ts";
export interface SmsDispatchControl {
  enabled: boolean;
  revision: number;
  updatedAt: string;
  updatedByName: string | null;
}
export function smsDispatchControlKey(actor: SenderIdentityActor) {
  return ["smsDispatchControl", actor.userId, actor.role, actor.tenantId, "platform"] as const;
}
export function smsDispatchControlPath(actor: SenderIdentityActor) {
  if (actor.role !== "super_admin" || !actor.userId || actor.tenantId !== null)
    throw new Error("Platform access required");
  return "/platform/sms-dispatch";
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid dispatch control response");
  return value as Record<string, unknown>;
}
export function mapSmsDispatchChange(value: unknown) {
  const row = record(value);
  if (
    typeof row["enabled"] !== "boolean" ||
    !Number.isSafeInteger(row["revision"]) ||
    (row["revision"] as number) < 0 ||
    (row["enabled"] === true && (row["revision"] as number) < 1)
  )
    throw new Error("Invalid dispatch control response");
  return { enabled: row["enabled"], revision: row["revision"] as number };
}
export function mapSmsDispatchControl(value: unknown): SmsDispatchControl {
  const row = record(value),
    change = mapSmsDispatchChange(row);
  if (
    typeof row["updatedAt"] !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$(?![\s\S])/.test(row["updatedAt"]) ||
    !Number.isFinite(Date.parse(row["updatedAt"])) ||
    !(
      row["updatedByName"] === null ||
      (typeof row["updatedByName"] === "string" && row["updatedByName"].length <= 201)
    )
  )
    throw new Error("Invalid dispatch control response");
  return { ...change, updatedAt: row["updatedAt"], updatedByName: row["updatedByName"] };
}
export function smsDispatchChangeBody(enabled: boolean, revision: number, confirmed: boolean) {
  if (
    typeof enabled !== "boolean" ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    (enabled && confirmed !== true)
  )
    throw new Error("Dispatch change confirmation required");
  return { enabled, expectedRevision: revision, confirmEnable: enabled && confirmed };
}
