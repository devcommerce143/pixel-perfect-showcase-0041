import type { Paginated, SenderIdentityActor } from "./types.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";
export const EMAIL_READINESS_STATES = ["NOT_CONFIGURED", "PENDING", "VERIFIED", "FAILED"] as const;
export type EmailReadinessState = (typeof EMAIL_READINESS_STATES)[number];
export interface EmailReadinessStates {
  domainVerificationStatus: EmailReadinessState;
  spfStatus: EmailReadinessState;
  dkimStatus: EmailReadinessState;
}
export interface EmailEvidenceCurrent extends EmailReadinessStates {
  senderId: string;
  tenantId: string;
  domain: string;
}
export interface EmailEvidenceInput extends EmailReadinessStates {
  domain: string;
  evidenceReference: string;
  expected: EmailReadinessStates;
  expectedRevision: number;
}
export interface EmailEvidenceRecord {
  id: string;
  actorUserId: string | null;
  createdAt: string;
  evidenceReference: string | null;
  source: "OPERATOR_REVIEW" | null;
  domainVerificationStatus: EmailReadinessState | null;
  spfStatus: EmailReadinessState | null;
  dkimStatus: EmailReadinessState | null;
}
export interface EmailEvidencePage extends Paginated<EmailEvidenceRecord> {
  current: EmailEvidenceCurrent;
}
export const EMAIL_EVIDENCE_REFERENCE = /^(ticket|change|review):[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
function fail(): never {
  throw new Error("Invalid email evidence contract");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function text(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : fail();
}
function uuid(value: unknown) {
  const id = text(value);
  return isTenantUuid(id) ? id : fail();
}
function count(value: unknown, min = 0): number {
  return Number.isSafeInteger(value) && (value as number) >= min ? (value as number) : fail();
}
function state(value: unknown): EmailReadinessState {
  return EMAIL_READINESS_STATES.includes(value as EmailReadinessState)
    ? (value as EmailReadinessState)
    : fail();
}
function states(value: unknown): EmailReadinessStates {
  const row = record(value);
  return {
    domainVerificationStatus: state(row["domainVerificationStatus"]),
    spfStatus: state(row["spfStatus"]),
    dkimStatus: state(row["dkimStatus"]),
  };
}
function timestamp(value: unknown) {
  const result = text(value),
    date = new Date(result);
  return Number.isFinite(date.getTime()) && date.toISOString() === result ? result : fail();
}
export function emailEvidenceKey(actor: SenderIdentityActor, tenantId: string, senderId: string) {
  return [
    "emailEvidence",
    actor.userId,
    actor.role,
    actor.tenantId,
    "platform",
    tenantId,
    senderId,
  ] as const;
}
export function emailEvidencePath(
  actor: SenderIdentityActor,
  tenantId: string,
  senderId: string,
  page?: number,
) {
  if (actor.role !== "super_admin" || !actor.userId) fail();
  const path = `/tenants/${uuid(tenantId)}/senders/${uuid(senderId)}/email-evidence`;
  if (page === undefined) return path;
  count(page, 1);
  if ((page - 1) * 20 > 2147483647) fail();
  return `${path}?page=${page}&pageSize=20`;
}
export function emailEvidenceBody(input: EmailEvidenceInput): EmailEvidenceInput {
  const domain = text(input.domain);
  if (domain.length > 255 || !EMAIL_EVIDENCE_REFERENCE.test(input.evidenceReference)) fail();
  return {
    ...states(input),
    domain,
    evidenceReference: input.evidenceReference,
    expected: states(input.expected),
    expectedRevision: count(input.expectedRevision),
  };
}
export function mapEmailEvidenceCurrent(
  value: unknown,
  tenantId: string,
  senderId: string,
  input?: EmailEvidenceInput,
): EmailEvidenceCurrent {
  const row = record(value),
    result = {
      senderId: uuid(row["senderId"]),
      tenantId: uuid(row["tenantId"]),
      domain: text(row["domain"]),
      ...states(row),
    };
  if (result.senderId !== senderId || result.tenantId !== tenantId) fail();
  if (
    input &&
    (result.domain !== input.domain ||
      result.domainVerificationStatus !== input.domainVerificationStatus ||
      result.spfStatus !== input.spfStatus ||
      result.dkimStatus !== input.dkimStatus)
  )
    fail();
  return result;
}
export function mapEmailEvidencePage(
  value: unknown,
  tenantId: string,
  senderId: string,
  page: number,
): EmailEvidencePage {
  const body = record(value);
  if (body["page"] !== page || body["pageSize"] !== 20 || !Array.isArray(body["items"])) fail();
  const items = (body["items"] as unknown[]).map((value): EmailEvidenceRecord => {
    const row = record(value),
      reference = row["evidenceReference"] === null ? null : text(row["evidenceReference"]);
    if (reference !== null && !EMAIL_EVIDENCE_REFERENCE.test(reference)) fail();
    if (row["source"] !== null && row["source"] !== "OPERATOR_REVIEW") fail();
    return {
      id: uuid(row["id"]),
      actorUserId: row["actorUserId"] === null ? null : uuid(row["actorUserId"]),
      createdAt: timestamp(row["createdAt"]),
      evidenceReference: reference,
      source: row["source"] as "OPERATOR_REVIEW" | null,
      domainVerificationStatus:
        row["domainVerificationStatus"] === null ? null : state(row["domainVerificationStatus"]),
      spfStatus: row["spfStatus"] === null ? null : state(row["spfStatus"]),
      dkimStatus: row["dkimStatus"] === null ? null : state(row["dkimStatus"]),
    };
  });
  const total = count(body["total"]);
  if (
    items.length > 20 ||
    items.length > total ||
    new Set(items.map((row) => row.id)).size !== items.length
  )
    fail();
  return {
    current: mapEmailEvidenceCurrent(body["current"], tenantId, senderId),
    items,
    page,
    pageSize: 20,
    total,
  };
}
