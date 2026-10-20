import type { DolfConnectApi } from "../client.ts";
import { createHumanHttpClient } from "./client.ts";
import { ApiError } from "./errors.ts";
import {
  applicationDetailPath,
  applicationListPath,
  mapApplication,
  mapApplicationPage,
  mapPlatformApplicationPage,
  platformApplicationListPath,
} from "./application-mapper.ts";
import { mapMessageHistoryDetail, mapMessageHistoryPage, mapPlatformMessageHistoryPage, messageHistoryDetailPath, messageHistoryListPath, platformMessageHistoryListPath } from "./message-history-mapper.ts";
import { mapDashboardMessages } from "./dashboard-messages-mapper.ts";
import { mapDashboardQuota } from "./dashboard-quota-mapper.ts";
import { mapDashboardSummary } from "./dashboard-mapper.ts";
import {
  mapPlanPage,
  mapPlanResponse,
  PlanCatalogError,
  toCreatePlanRequest,
} from "./plan-mapper.ts";
import type { LiveCreatePlanInput } from "./plan-mapper.ts";
import { applyPlanEditRequests, createPlanEditRequests } from "./plan-editing.ts";
import { createUnconnectedLiveApi } from "./unconnected-api.ts";
import { planListPath } from "../plans-catalog.ts";
import { mapTenantCreateResponse, mapTenantPage, mapTenantResponse, tenantDetailPath, tenantListPath, tenantStatusPath, toTenantCreateRequest, toTenantProfileUpdateRequest, toTenantStatusRequest, TenantCatalogError } from "./tenant-mapper.ts";
import {
  mapTenantSubscriptionHistoryPage,
  mapTenantPlanAssignmentResponse,
  mapTenantSubscriptionView,
  tenantPlanAssignmentPath,
  tenantSubscriptionCancelPath,
  tenantSubscriptionChannelPath,
  tenantSubscriptionHistoryPath,
  tenantSubscriptionOverridesPath,
  tenantSubscriptionPath,
  toTenantSubscriptionChannelOverrideRequest,
  toTenantSubscriptionOverridesRequest,
  toTenantPlanAssignmentRequest,
} from "./tenant-subscription-mapper.ts";
import {
  mapUserPage,
  mapUserResponse,
  toCreateUserRequest,
  toUpdateUserProfileRequest,
  toUserRoleRequest,
  toUserStatusRequest,
  userCreatePath,
  userItemPath,
  userListPath,
} from "./user-mapper.ts";
import type {
  Channel,
  CreatePortalUserInput,
  MessageHistoryQuery,
  Plan,
  PlanListQuery,
  TenantListQuery,
  TenantPlanAssignmentInput,
  TenantProfileUpdateInput,
  TenantStatus,
  TenantSubscriptionChannelOverrideInput,
  TenantSubscriptionHistoryQuery,
  TenantSubscriptionOverridesInput,
  TenantUserRole,
  UpdatePortalUserProfileInput,
  UserListQuery,
  UserStatus,
} from "../types.ts";

const API_PLAN_STATUSES: Record<Plan["status"], "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED"> = {
  draft: "DRAFT",
  active: "ACTIVE",
  inactive: "INACTIVE",
  archived: "ARCHIVED",
};

/**
 * Live portal API. Dashboard and plan catalog operations use the engine.
 * Every other operation still rejects with `LiveApiNotConnectedError`.
 * The request uses the shared human client, which attaches the current Bearer access token.
 */
export function createLiveApi(options: {
  apiBaseUrl: string | null;
  getAccessToken: () => string | null;
  fetchImpl?: typeof fetch;
}): DolfConnectApi {
  const unavailable = createUnconnectedLiveApi();
  if (!options.apiBaseUrl) return unavailable;

  const http = createHumanHttpClient({
    apiBaseUrl: options.apiBaseUrl,
    getAccessToken: options.getAccessToken,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  return new Proxy(unavailable, {
    get(target, property, receiver) {
      if (property === "getDashboard") {
        return async () => mapDashboardSummary(await http.get("/dashboard"));
      }
      if (property === "getDashboardMessages") {
        return async () => mapDashboardMessages(await http.get("/dashboard/messages"));
      }
      if (property === "getDashboardQuota") {
        return async () => mapDashboardQuota(await http.get("/dashboard/quota"));
      }
      if (property === "listApplicationsPage") {
        return async (
          actor: Parameters<DolfConnectApi["listApplicationsPage"]>[0],
          query: Parameters<DolfConnectApi["listApplicationsPage"]>[1],
          tenantId?: string,
        ) =>
          mapApplicationPage(
            await http.get(
              applicationListPath(
                actor.role,
                query.page ?? 1,
                query.pageSize ?? 20,
                actor.role === "super_admin" ? tenantId : undefined,
              ),
            ),
          );
      }
      if (property === "listAllTenantApplications") {
        return async (
          actor: Parameters<DolfConnectApi["listAllTenantApplications"]>[0],
          query: Parameters<DolfConnectApi["listAllTenantApplications"]>[1],
        ) => {
          if (actor.role !== "super_admin") {
            throw new Error(
              "Platform applications require a platform administrator.",
            );
          }
          return mapPlatformApplicationPage(
            await http.get(
              platformApplicationListPath(
                query.page ?? 1,
                query.pageSize ?? 20,
              ),
            ),
          );
        };
      }
      if (property === "getApplication") {
        return async (
          actor: Parameters<DolfConnectApi["getApplication"]>[0],
          id: string,
          tenantId?: string,
        ) => {
          try {
            return mapApplication(
              await http.get(
                applicationDetailPath(
                  actor.role,
                  id,
                  actor.role === "super_admin" ? tenantId : undefined,
                ),
              ),
            );
          } catch (error) {
            if (error instanceof ApiError && error.statusCode === 404) return null;
            throw error;
          }
        };
      }
      if (property === "listMessageHistory") {
        return async (
          query: MessageHistoryQuery,
          actor: Parameters<DolfConnectApi["listMessageHistory"]>[1],
          targetTenantId?: string,
        ) => {
          const tenantId = actor.role === "super_admin" ? requirePlatformHistoryTenant(targetTenantId) : undefined;
          return mapMessageHistoryPage(await http.get(messageHistoryListPath(query, tenantId)));
        };
      }
      if (property === "listAllTenantMessageHistory") {
        return async (
          query: MessageHistoryQuery,
          actor: Parameters<DolfConnectApi["listAllTenantMessageHistory"]>[1],
        ) => {
          if (actor.role !== "super_admin") {
            throw new Error("Platform message history requires a platform administrator.");
          }
          return mapPlatformMessageHistoryPage(
            await http.get(platformMessageHistoryListPath(query)),
          );
        };
      }
      if (property === "getMessageHistory") {
        return async (
          id: string,
          actor: Parameters<DolfConnectApi["getMessageHistory"]>[1],
          targetTenantId?: string,
        ) => {
          const tenantId = actor.role === "super_admin" ? requirePlatformHistoryTenant(targetTenantId) : undefined;
          try {
            return mapMessageHistoryDetail(await http.get(messageHistoryDetailPath(id, tenantId)));
          } catch (error) {
            if (error instanceof ApiError && error.statusCode === 404) return null;
            throw error;
          }
        };
      }
      if (property === "listPlans") {
        return async (query?: PlanListQuery) => mapPlanPage(await http.get(planListPath(query)));
      }
      if (property === "listTenants") {
        return async (query: TenantListQuery) =>
          mapTenantPage(await http.get(tenantListPath(query.page, query.pageSize)));
      }
      if (property === "getTenant") {
        return async (tenantId: string) =>
          mapTenantResponse(await http.get(tenantDetailPath(tenantId)));
      }
      if (property === "createTenant") {
        return async (input: Parameters<DolfConnectApi["createTenant"]>[0]) =>
          mapTenantCreateResponse(await http.post("/tenants", toTenantCreateRequest(input)));
      }
      if (property === "updateTenantProfile") {
        return async (tenantId: string, input: TenantProfileUpdateInput) =>
          mapTenantResponse(await http.patch(
            tenantDetailPath(tenantId),
            toTenantProfileUpdateRequest(input),
          ));
      }
      if (property === "setTenantStatus") {
        return async (tenantId: string, status: TenantStatus) => {
          const updated = mapTenantResponse(await http.post(
            tenantStatusPath(tenantId),
            toTenantStatusRequest(status),
          ));
          if (updated.id !== tenantId) {
            throw new TenantCatalogError("Tenant status response belongs to a different tenant.");
          }
          if (updated.status !== status) {
            throw new TenantCatalogError("Tenant status response does not match the requested status.");
          }
        };
      }
      if (property === "getTenantSubscription") {
        return async (tenantId: string) =>
          mapTenantSubscriptionView(
            await http.get(tenantSubscriptionPath(tenantId)),
            tenantId,
          );
      }
      if (property === "getTenantSubscriptionHistory") {
        return async (tenantId: string, query: TenantSubscriptionHistoryQuery) =>
          mapTenantSubscriptionHistoryPage(
            await http.get(tenantSubscriptionHistoryPath(tenantId, query)),
            tenantId,
          );
      }
      if (property === "assignTenantPlan") {
        return async (tenantId: string, input: TenantPlanAssignmentInput) =>
          mapTenantPlanAssignmentResponse(
            await http.post(
              tenantPlanAssignmentPath(tenantId),
              toTenantPlanAssignmentRequest(input),
            ),
            tenantId,
            input,
          );
      }
      if (property === "updateTenantSubscriptionOverrides") {
        return async (tenantId: string, input: TenantSubscriptionOverridesInput) =>
          mapTenantSubscriptionView(
            await http.put(
              tenantSubscriptionOverridesPath(tenantId),
              toTenantSubscriptionOverridesRequest(input),
            ),
            tenantId,
          );
      }
      if (property === "setTenantSubscriptionChannelOverride") {
        return async (
          tenantId: string,
          channel: Channel,
          input: TenantSubscriptionChannelOverrideInput,
        ) =>
          mapTenantSubscriptionView(
            await http.put(
              tenantSubscriptionChannelPath(tenantId, channel),
              toTenantSubscriptionChannelOverrideRequest(input),
            ),
            tenantId,
          );
      }
      if (property === "clearTenantSubscriptionChannelOverride") {
        return async (tenantId: string, channel: Channel) =>
          mapTenantSubscriptionView(
            await http.delete(tenantSubscriptionChannelPath(tenantId, channel)),
            tenantId,
          );
      }
      if (property === "cancelTenantSubscription") {
        return async (tenantId: string) =>
          mapTenantSubscriptionView(
            await http.post(tenantSubscriptionCancelPath(tenantId), {}),
            tenantId,
          );
      }
      if (property === "listUsers") {
        return async (
          actor: Parameters<DolfConnectApi["listUsers"]>[0],
          query: UserListQuery,
          targetTenantId?: string,
        ) => mapUserPage(await http.get(
          userListPath(actor.role, query, targetTenantId),
        ));
      }
      if (property === "inviteUser") {
        return async (
          actor: Parameters<DolfConnectApi["inviteUser"]>[0],
          input: CreatePortalUserInput,
          targetTenantId?: string,
        ) => mapUserResponse(await http.post(
          userCreatePath(actor.role, targetTenantId),
          toCreateUserRequest(input),
        ));
      }
      if (property === "updateUser") {
        return async (
          actor: Parameters<DolfConnectApi["updateUser"]>[0],
          id: string,
          input: UpdatePortalUserProfileInput,
          targetTenantId?: string,
        ) => mapUserResponse(await http.patch(
          userItemPath(actor.role, id, targetTenantId),
          toUpdateUserProfileRequest(input),
        ));
      }
      if (property === "setUserRole") {
        return async (
          actor: Parameters<DolfConnectApi["setUserRole"]>[0],
          id: string,
          role: TenantUserRole,
          targetTenantId?: string,
        ) => mapUserResponse(await http.post(
          `${userItemPath(actor.role, id, targetTenantId)}/role`,
          toUserRoleRequest(role),
        ));
      }
      if (property === "setUserStatus") {
        return async (
          actor: Parameters<DolfConnectApi["setUserStatus"]>[0],
          id: string,
          status: UserStatus,
          targetTenantId?: string,
        ) => mapUserResponse(await http.post(
          `${userItemPath(actor.role, id, targetTenantId)}/status`,
          toUserStatusRequest(status),
        ));
      }
      if (property === "getPlan") {
        return async (id: string) =>
          mapPlanResponse(await http.get(`/plans/${encodeURIComponent(id)}`));
      }
      if (property === "createPlan") {
        return async (input: Parameters<DolfConnectApi["createPlan"]>[0]) => {
          if (input.status !== "draft" && input.status !== "active") {
            throw new PlanCatalogError("A new live plan must be draft or active.");
          }
          const liveInput: LiveCreatePlanInput = { ...input, status: input.status };
          return mapPlanResponse(await http.post("/plans", toCreatePlanRequest(liveInput)));
        };
      }
      if (property === "setPlanStatus") {
        return async (id: string, status: Plan["status"]) => {
          await http.post<unknown>(`/plans/${encodeURIComponent(id)}/status`, {
            status: API_PLAN_STATUSES[status],
          });
        };
      }
      if (property === "updatePlan") {
        return async (
          id: string,
          input: Parameters<DolfConnectApi["updatePlan"]>[1],
          baseline?: Parameters<DolfConnectApi["updatePlan"]>[2],
        ) => {
          if (!baseline)
            throw new PlanCatalogError("A plan baseline is required for live editing.");
          const draft = {
            ...baseline,
            ...input,
            entitlements: input.entitlements.map((item) => ({ ...item })),
            features: [...input.features],
          };
          const requests = createPlanEditRequests(id, baseline, draft);
          return applyPlanEditRequests(
            baseline,
            draft,
            requests,
            async (request) =>
              mapPlanResponse(
                request.method === "PATCH"
                  ? await http.patch(request.path, request.body)
                  : await http.put(request.path, request.body),
              ),
            async () => mapPlanResponse(await http.get(`/plans/${encodeURIComponent(id)}`)),
          );
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function requirePlatformHistoryTenant(tenantId: string | undefined): string {
  if (!tenantId) throw new Error("Select a tenant before loading platform message history.");
  return tenantId;
}
