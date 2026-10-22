import type { SenderIdentityActor } from "./types.ts";
import type { ProviderCursorPage, ProviderMonitorQuery } from "./provider-monitoring.ts";
import { ApiError } from "./http/errors.ts";
export type RouteChannel = "SMS" | "EMAIL" | "WHATSAPP";
export type RouteStatus = "ACTIVE" | "DISABLED";
export interface ConfiguredRouteMember {
  id: string;
  providerAccountId: string;
  providerCode: string;
  providerChannel: RouteChannel;
  providerStatus: "ACTIVE" | "RETIRED";
  priority: number;
  enabled: boolean;
}
export interface ConfiguredProviderRoute {
  id: string;
  code: string;
  channel: RouteChannel;
  status: RouteStatus;
  members: ConfiguredRouteMember[];
}
export interface ProviderRouteQuery extends ProviderMonitorQuery {
  status?: RouteStatus;
}
export type ProviderRoutePage = ProviderCursorPage<ConfiguredProviderRoute>;
export interface TenantRouteAssignment {
  id: string;
  tenantId: string;
  channel: RouteChannel;
  routeId: string;
  routeCode: string;
  routeStatus: RouteStatus;
}
export interface SenderRouteAssignment {
  id: string;
  tenantId: string;
  senderIdentityId: string;
  routeId: string;
  routeCode: string;
  routeChannel: RouteChannel;
  routeStatus: RouteStatus;
}
export type ProviderRouteOperation =
  | { kind: "create"; code: string; channel: RouteChannel }
  | { kind: "status"; routeId: string; status: RouteStatus }
  | {
      kind: "addMember";
      routeId: string;
      providerAccountId: string;
      priority: number;
      enabled: boolean;
    }
  | { kind: "updateMember"; routeId: string; memberId: string; priority: number; enabled: boolean }
  | { kind: "assignTenant"; tenantId: string; channel: RouteChannel; routeId: string }
  | { kind: "assignSender"; tenantId: string; senderIdentityId: string; routeId: string };
export type ProviderRouteMutationResult =
  | { kind: "route"; route: ConfiguredProviderRoute }
  | { kind: "tenant"; assignment: TenantRouteAssignment }
  | { kind: "sender"; assignment: SenderRouteAssignment };
export function providerRouteKey(actor: SenderIdentityActor) {
  return ["providerRoutes", actor.userId, actor.role, actor.tenantId, "platform"] as const;
}
export function providerRouteFailureKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return "liveRouting.forbidden";
    if (error.statusCode === 404) return "liveRouting.notFound";
    if (error.statusCode === 409 || error.statusCode === 400 || error.statusCode === 422)
      return "liveRouting.validation";
  }
  return "liveRouting.error";
}
