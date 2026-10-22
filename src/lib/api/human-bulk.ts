import type { SenderIdentityActor } from "./types.ts";
import { roleHas } from "../auth/permissions.ts";
import { humanMessageBody, humanMessagePath, humanMessageScope } from "./human-message.ts";
import type { HumanMessageInput } from "./human-message.ts";
import { BULK_HISTORY_STATUSES } from "./bulk-job-history-types.ts";
import type { BulkHistoryStatus } from "./bulk-job-history-types.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";
import type { Channel } from "./types.ts";

export interface HumanBulkCsvInput {
  channel: Channel;
  senderId: string;
  mode: "SHARED" | "PERSONALIZED";
  csv: string;
}
export function humanBulkCsvBody(input: HumanBulkCsvInput) {
  if (
    !isTenantUuid(input.senderId) ||
    !["sms", "email", "whatsapp"].includes(input.channel) ||
    !["SHARED", "PERSONALIZED"].includes(input.mode) ||
    typeof input.csv !== "string" ||
    !input.csv.trim() ||
    input.csv.includes("\0") ||
    new TextEncoder().encode(input.csv).byteLength > 2 * 1024 * 1024
  )
    fail();
  const body = {
    confirm: true,
    channel: input.channel.toUpperCase(),
    senderId: input.senderId,
    mode: input.mode,
    csv: input.csv,
  };
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 2 * 1024 * 1024) fail();
  return body;
}

export interface HumanBulkReceipt {
  id: string;
  tenantId: string;
  applicationId: string;
  status: BulkHistoryStatus;
  replay: boolean;
  itemCount: number;
  invalidCount: number;
  pendingCount: number;
  acceptedCount: number;
  skippedCount: number;
  failedCount: number;
  createdAt: string;
}
function fail(): never {
  throw new Error("Invalid human bulk contract");
}
export function humanBulkPath(
  actor: SenderIdentityActor,
  applicationId: string,
  tenantId?: string,
) {
  if (!roleHas(actor.role, "messages.bulk.create")) fail();
  return humanMessagePath(actor, applicationId, tenantId).replace(/\/messages$/, "/bulk-jobs");
}
export function humanBulkKey(actor: SenderIdentityActor, tenantId?: string) {
  return ["humanBulk", actor.userId, actor.role, actor.tenantId, tenantId ?? null] as const;
}
/** A shared-content job with explicitly reviewed recipients; no provider calls. */
export function humanBulkBody(input: HumanMessageInput) {
  const recipients = input.recipient
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (!recipients.length || recipients.length > 1000) fail();
  for (const recipient of recipients) humanMessageBody({ ...input, recipient });
  const first = humanMessageBody({ ...input, recipient: recipients[0]! });
  return {
    confirm: true,
    channel: first.channel,
    senderId: first.senderId,
    mode: "SHARED",
    ...("sms" in first ? { sms: first.sms } : {}),
    ...("email" in first ? { email: first.email } : {}),
    ...("whatsapp" in first ? { whatsapp: first.whatsapp } : {}),
    items: recipients.map((recipient) => ({ recipient })),
  };
}
export function mapHumanBulkReceipt(
  value: unknown,
  actor: SenderIdentityActor,
  applicationId: string,
  tenantId?: string,
): HumanBulkReceipt {
  humanBulkPath(actor, applicationId, tenantId);
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const row = value as Record<string, unknown>;
  const scope = humanMessageScope(actor, tenantId);
  if (
    typeof row["id"] !== "string" ||
    !isTenantUuid(row["id"]) ||
    row["tenantId"] !== scope ||
    row["applicationId"] !== applicationId ||
    typeof row["replay"] !== "boolean"
  )
    fail();
  const status = typeof row["status"] === "string" ? row["status"].toLowerCase() : "";
  if (!BULK_HISTORY_STATUSES.includes(status as BulkHistoryStatus)) fail();
  const count = (name: string) =>
    Number.isSafeInteger(row[name]) && (row[name] as number) >= 0 ? (row[name] as number) : fail();
  const result = {
    id: row["id"],
    tenantId: scope,
    applicationId,
    status: status as BulkHistoryStatus,
    replay: row["replay"],
    itemCount: count("itemCount"),
    invalidCount: count("invalidCount"),
    pendingCount: count("pendingCount"),
    acceptedCount: count("acceptedCount"),
    skippedCount: count("skippedCount"),
    failedCount: count("failedCount"),
    createdAt: typeof row["createdAt"] === "string" ? row["createdAt"] : fail(),
  };
  if (
    !Number.isFinite(Date.parse(result.createdAt)) ||
    new Date(result.createdAt).toISOString() !== result.createdAt ||
    result.itemCount > 1000 ||
    result.itemCount < 1 ||
    result.itemCount !==
      result.invalidCount +
        result.pendingCount +
        result.acceptedCount +
        result.skippedCount +
        result.failedCount
  )
    fail();
  return result;
}
