import type { SenderIdentityActor } from "./types.ts";
import { roleHas } from "../auth/permissions.ts";
import { isTenantUuid } from "./http/tenant-mapper.ts";
import { TEMPLATE_REGISTRY_KEY, TEMPLATE_REGISTRY_LANGUAGE } from "./template-registry.ts";

export interface ContentTemplateQuery {
  page: number;
  pageSize: number;
  channel?: "sms" | "email";
  registryStatus?: "draft" | "ready" | "retired";
  templateKey?: string;
}
export interface ContentTemplateRow {
  id: string;
  tenantId: string;
  channel: "sms" | "email";
  templateKey: string;
  language: string;
  version: number;
  registryStatus: "draft" | "ready" | "retired";
  createdAt: string;
  updatedAt: string;
}
export interface ContentTemplateDetail extends ContentTemplateRow {
  body: string;
  subject: string | null;
  parameters: string[];
}
export interface ContentTemplatePage {
  items: ContentTemplateRow[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ContentTemplateInput {
  channel: "sms" | "email";
  templateKey: string;
  language: string;
  body: string;
  subject?: string;
}
export interface RenderedContentTemplate {
  templateId: string;
  version: number;
  channel: "sms" | "email";
  body: string;
  subject?: string;
}
export type ContentTemplateOperation =
  { kind: "create"; input: ContentTemplateInput } | { kind: "ready" | "retire"; id: string };
function fail(): never {
  throw new Error("Invalid content template contract");
}
function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max
    ? value
    : fail();
}
function integer(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : fail();
}
function uuid(value: unknown) {
  return typeof value === "string" && isTenantUuid(value) ? value : fail();
}
function instant(value: unknown) {
  const v = text(value, 32);
  return Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v ? v : fail();
}
export function contentTemplateScope(actor: SenderIdentityActor, tenantId?: string) {
  if (!actor.userId || !roleHas(actor.role, "templates.view")) fail();
  const scope = actor.role === "super_admin" ? tenantId : actor.tenantId;
  if (
    !scope ||
    !isTenantUuid(scope) ||
    (actor.role !== "super_admin" && tenantId !== undefined && tenantId !== scope)
  )
    fail();
  return scope;
}
export function contentTemplatePath(actor: SenderIdentityActor, tenantId?: string, id?: string) {
  const scope = contentTemplateScope(actor, tenantId);
  return `${actor.role === "super_admin" ? `/tenants/${scope}` : ""}/content-templates${id ? `/${uuid(id)}` : ""}`;
}
export function contentTemplateKey(
  actor: SenderIdentityActor,
  tenantId?: string,
  query?: ContentTemplateQuery,
  id?: string,
) {
  return [
    "contentTemplates",
    actor.userId,
    actor.role,
    actor.tenantId,
    tenantId ?? null,
    id ?? null,
    query ?? null,
  ] as const;
}
export function contentTemplateQuery(query: ContentTemplateQuery) {
  if (
    integer(query.page) < 1 ||
    query.page > 2147483647 ||
    integer(query.pageSize) < 1 ||
    query.pageSize > 100
  )
    fail();
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.channel) {
    if (!["sms", "email"].includes(query.channel)) fail();
    params.set("channel", query.channel.toUpperCase());
  }
  if (query.registryStatus) {
    if (!["draft", "ready", "retired"].includes(query.registryStatus)) fail();
    params.set("registryStatus", query.registryStatus.toUpperCase());
  }
  if (query.templateKey !== undefined) {
    if (!TEMPLATE_REGISTRY_KEY.test(query.templateKey)) fail();
    params.set("templateKey", query.templateKey);
  }
  return `?${params}`;
}
export function mapContentTemplate(value: unknown, tenantId: string): ContentTemplateRow {
  const row = record(value),
    channel = text(row["channel"], 5).toLowerCase(),
    state = text(row["registryStatus"], 10).toLowerCase();
  if (
    uuid(row["tenantId"]) !== tenantId ||
    !["sms", "email"].includes(channel) ||
    !["draft", "ready", "retired"].includes(state) ||
    integer(row["version"]) < 1
  )
    fail();
  const key = text(row["templateKey"], 64),
    language = text(row["language"], 16);
  if (!TEMPLATE_REGISTRY_KEY.test(key) || !TEMPLATE_REGISTRY_LANGUAGE.test(language)) fail();
  return {
    id: uuid(row["id"]),
    tenantId,
    channel: channel as ContentTemplateRow["channel"],
    templateKey: key,
    language,
    version: integer(row["version"]),
    registryStatus: state as ContentTemplateRow["registryStatus"],
    createdAt: instant(row["createdAt"]),
    updatedAt: instant(row["updatedAt"]),
  };
}
export function mapContentTemplateDetail(
  value: unknown,
  tenantId: string,
  id?: string,
): ContentTemplateDetail {
  const row = record(value),
    metadata = mapContentTemplate(value, tenantId);
  if (id !== undefined && metadata.id !== id) fail();
  const parameters = row["parameters"];
  if (
    !Array.isArray(parameters) ||
    parameters.length > 20 ||
    new Set(parameters).size !== parameters.length ||
    parameters.some((v) => typeof v !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(v))
  )
    fail();
  const subject =
    metadata.channel === "email"
      ? text(row["subject"], 200)
      : row["subject"] === null
        ? null
        : fail();
  return {
    ...metadata,
    body: text(row["body"], metadata.channel === "sms" ? 1600 : 20000),
    subject,
    parameters: parameters as string[],
  };
}
export function mapContentTemplatePage(
  value: unknown,
  tenantId: string,
  query: ContentTemplateQuery,
): ContentTemplatePage {
  const row = record(value);
  if (
    row["page"] !== query.page ||
    row["pageSize"] !== query.pageSize ||
    !Array.isArray(row["items"]) ||
    row["items"].length > query.pageSize
  )
    fail();
  const items = row["items"].map((v) => mapContentTemplate(v, tenantId)),
    total = integer(row["total"]);
  if (
    items.length > total ||
    items.some(
      (item) =>
        (query.channel !== undefined && item.channel !== query.channel) ||
        (query.registryStatus !== undefined && item.registryStatus !== query.registryStatus) ||
        (query.templateKey !== undefined && item.templateKey !== query.templateKey),
    )
  )
    fail();
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
export function contentTemplateMutation(
  actor: SenderIdentityActor,
  operation: ContentTemplateOperation,
  tenantId?: string,
) {
  if (
    !roleHas(
      actor.role,
      actor.role === "super_admin" ? "platform.templates.manage" : "templates.manage",
    )
  )
    fail();
  const base = contentTemplatePath(actor, tenantId);
  if (operation.kind !== "create")
    return { path: `${base}/${uuid(operation.id)}/${operation.kind}`, body: {} };
  const input = operation.input;
  if (
    !["sms", "email"].includes(input.channel) ||
    !TEMPLATE_REGISTRY_KEY.test(input.templateKey) ||
    !TEMPLATE_REGISTRY_LANGUAGE.test(input.language)
  )
    fail();
  return {
    path: base,
    body: {
      channel: input.channel.toUpperCase(),
      templateKey: input.templateKey,
      language: input.language,
      body: text(input.body, input.channel === "sms" ? 1600 : 20000),
      ...(input.channel === "email" ? { subject: text(input.subject, 200) } : {}),
    },
  };
}
export function mapRenderedContent(value: unknown, id: string): RenderedContentTemplate {
  const row = record(value),
    channel = text(row["channel"], 5).toLowerCase();
  if (
    uuid(row["templateId"]) !== id ||
    !["sms", "email"].includes(channel) ||
    integer(row["version"]) < 1
  )
    fail();
  return {
    templateId: id,
    version: integer(row["version"]),
    channel: channel as "sms" | "email",
    body: text(row["body"], channel === "sms" ? 1600 : 20000),
    ...(channel === "email" ? { subject: text(row["subject"], 200) } : {}),
  };
}
export function contentTemplateRenderBody(parameters: Record<string, string>) {
  const values = record(parameters),
    entries = Object.entries(values);
  if (
    entries.length > 20 ||
    entries.some(
      ([key, value]) =>
        !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key) ||
        typeof value !== "string" ||
        value.length > 1000,
    )
  )
    fail();
  return { parameters: Object.fromEntries(entries) };
}
