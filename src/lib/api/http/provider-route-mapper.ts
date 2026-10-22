import type { SenderIdentityActor } from "../types.ts";
import type {
  ConfiguredProviderRoute,
  ConfiguredRouteMember,
  ProviderRouteQuery,
  ProviderRouteOperation,
  ProviderRouteMutationResult,
  TenantRouteAssignment,
  SenderRouteAssignment,
} from "../provider-routes.ts";
import { providerMonitorQuery } from "./provider-monitoring-mapper.ts";
import { isTenantUuid } from "./tenant-mapper.ts";
function fail(): never {
  throw new Error("Invalid provider route contract");
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail();
}
function text(value: unknown) {
  return typeof value === "string" && value.length ? value : fail();
}
function uuid(value: unknown) {
  const id = text(value);
  return isTenantUuid(id) ? id : fail();
}
function choice<T extends string>(value: unknown, allowed: readonly T[]): T {
  return allowed.includes(value as T) ? (value as T) : fail();
}
const channels = ["SMS", "EMAIL", "WHATSAPP"] as const,
  statuses = ["ACTIVE", "DISABLED"] as const;
function priority(value: unknown) {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 100
    ? (value as number)
    : fail();
}
function boolean(value: unknown) {
  return typeof value === "boolean" ? value : fail();
}
function authorize(actor: SenderIdentityActor) {
  if (actor.role !== "super_admin" || !actor.userId) fail();
}
export function providerRoutePath(actor: SenderIdentityActor, id: string) {
  authorize(actor);
  return `/provider-routes/${uuid(id)}`;
}
export function providerRoutesPath(actor: SenderIdentityActor, query: ProviderRouteQuery) {
  authorize(actor);
  const params = new URLSearchParams(providerMonitorQuery(query));
  if (query.status) params.set("status", choice(query.status, statuses));
  return `/provider-routes?${params.toString()}`;
}
export function tenantRoutePath(actor: SenderIdentityActor, tenant: string, channel: string) {
  authorize(actor);
  return `/provider-route-assignments/tenants/${uuid(tenant)}?${new URLSearchParams({ channel: choice(channel, channels) })}`;
}
export function senderRoutePath(actor: SenderIdentityActor, tenant: string, sender: string) {
  authorize(actor);
  uuid(tenant);
  return `/provider-route-assignments/senders/${uuid(sender)}`;
}
export function mapProviderRoute(value: unknown, id?: string): ConfiguredProviderRoute {
  const row = object(value),
    routeId = uuid(row["id"]);
  if ((id && routeId !== uuid(id)) || !Array.isArray(row["members"])) fail();
  const members: ConfiguredRouteMember[] = row["members"].map((value) => {
    const member = object(value);
    return {
      id: uuid(member["id"]),
      providerAccountId: uuid(member["providerAccountId"]),
      providerCode: text(member["providerCode"]),
      providerChannel: choice(member["providerChannel"], channels),
      providerStatus: choice(member["providerStatus"], ["ACTIVE", "RETIRED"]),
      priority: priority(member["priority"]),
      enabled: boolean(member["enabled"]),
    };
  });
  if (
    members.length > 100 ||
    new Set(members.map((m) => m.id)).size !== members.length ||
    new Set(members.map((m) => m.providerAccountId)).size !== members.length ||
    new Set(members.map((m) => m.priority)).size !== members.length
  )
    fail();
  return {
    id: routeId,
    code: text(row["code"]),
    channel: choice(row["channel"], channels),
    status: choice(row["status"], statuses),
    members,
  };
}
export function mapProviderRoutePage(value: unknown, query: ProviderRouteQuery) {
  providerMonitorQuery(query);
  const row = object(value);
  if (!Array.isArray(row["items"])) fail();
  const items = row["items"].map((value) => mapProviderRoute(value)),
    nextCursor = row["nextCursor"] === null ? null : uuid(row["nextCursor"]);
  if (
    items.length > query.limit ||
    new Set(items.map((r) => r.id)).size !== items.length ||
    (nextCursor !== null &&
      (items.length !== query.limit ||
        nextCursor !== items[items.length - 1]?.id ||
        nextCursor === query.cursor))
  )
    fail();
  return { items, nextCursor };
}
export function mapTenantRouteAssignment(
  value: unknown,
  tenant: string,
  channel: string,
): TenantRouteAssignment {
  const row = object(value);
  if (row["tenantId"] !== uuid(tenant) || row["channel"] !== choice(channel, channels)) fail();
  return {
    id: uuid(row["id"]),
    tenantId: tenant,
    channel: choice(row["channel"], channels),
    routeId: uuid(row["routeId"]),
    routeCode: text(row["routeCode"]),
    routeStatus: choice(row["routeStatus"], statuses),
  };
}
export function mapSenderRouteAssignment(
  value: unknown,
  tenant: string,
  sender: string,
): SenderRouteAssignment {
  const row = object(value);
  if (row["tenantId"] !== uuid(tenant) || row["senderIdentityId"] !== uuid(sender)) fail();
  return {
    id: uuid(row["id"]),
    tenantId: tenant,
    senderIdentityId: sender,
    routeId: uuid(row["routeId"]),
    routeCode: text(row["routeCode"]),
    routeChannel: choice(row["routeChannel"], channels),
    routeStatus: choice(row["routeStatus"], statuses),
  };
}
export function providerRouteMutationRequest(
  actor: SenderIdentityActor,
  operation: ProviderRouteOperation,
) {
  authorize(actor);
  if (operation.kind === "create") {
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(operation.code)) fail();
    return {
      path: "/provider-routes",
      body: { code: operation.code, channel: choice(operation.channel, channels) },
    };
  }
  if (operation.kind === "assignTenant")
    return {
      path: "/provider-route-assignments/tenants",
      body: {
        tenantId: uuid(operation.tenantId),
        channel: choice(operation.channel, channels),
        routeId: uuid(operation.routeId),
      },
    };
  if (operation.kind === "assignSender")
    return {
      path: "/provider-route-assignments/senders",
      body: {
        tenantId: uuid(operation.tenantId),
        senderIdentityId: uuid(operation.senderIdentityId),
        routeId: uuid(operation.routeId),
      },
    };
  const path = providerRoutePath(actor, operation.routeId);
  if (operation.kind === "status")
    return { path: `${path}/status`, body: { status: choice(operation.status, statuses) } };
  return operation.kind === "addMember"
    ? {
        path: `${path}/members`,
        body: {
          providerAccountId: uuid(operation.providerAccountId),
          priority: priority(operation.priority),
          enabled: boolean(operation.enabled),
        },
      }
    : {
        path: `${path}/members/${uuid(operation.memberId)}`,
        body: { priority: priority(operation.priority), enabled: boolean(operation.enabled) },
      };
}
export function mapProviderRouteMutation(
  value: unknown,
  operation: ProviderRouteOperation,
): ProviderRouteMutationResult {
  if (operation.kind === "assignTenant") {
    const assignment = mapTenantRouteAssignment(value, operation.tenantId, operation.channel);
    if (assignment.routeId !== operation.routeId) fail();
    return { kind: "tenant", assignment };
  }
  if (operation.kind === "assignSender") {
    const assignment = mapSenderRouteAssignment(
      value,
      operation.tenantId,
      operation.senderIdentityId,
    );
    if (assignment.routeId !== operation.routeId) fail();
    return { kind: "sender", assignment };
  }
  const route = mapProviderRoute(
    value,
    operation.kind === "create" ? undefined : operation.routeId,
  );
  if (
    (operation.kind === "create" &&
      (route.code !== operation.code ||
        route.channel !== operation.channel ||
        route.status !== "ACTIVE")) ||
    (operation.kind === "status" && route.status !== operation.status)
  )
    fail();
  if (operation.kind === "addMember" || operation.kind === "updateMember") {
    const member = route.members.find((m) =>
      operation.kind === "addMember"
        ? m.providerAccountId === operation.providerAccountId
        : m.id === operation.memberId,
    );
    if (!member || member.priority !== operation.priority || member.enabled !== operation.enabled)
      fail();
  }
  return { kind: "route", route };
}
