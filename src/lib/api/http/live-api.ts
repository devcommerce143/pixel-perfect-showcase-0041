import { senderMutationRequest, mapSenderMutation } from "./sender-mutation-mapper.ts";
import { mapNotificationPage, mapNotificationRead, mapNotificationsReadAll, notificationId, notificationPageNumber } from '../notifications.ts';
import {
  contentTemplateScope,
  contentTemplatePath,
  contentTemplateQuery,
  contentTemplateMutation,
  contentTemplateRenderBody,
  mapContentTemplatePage,
  mapContentTemplateDetail,
  mapRenderedContent,
} from "../content-template.ts";
import { bulkCancellationPath, mapBulkCancellation } from "../bulk-cancellation.ts";
import {
  humanBulkPath,
  humanBulkBody,
  humanBulkCsvBody,
  mapHumanBulkReceipt,
} from "../human-bulk.ts";
import { providerAttemptsPath, mapProviderAttempts } from "../provider-attempts.ts";
import {
  humanMessagePath,
  humanMessageBody,
  humanMessageIdempotencyKey,
  mapHumanMessageAcceptance,
} from "../human-message.ts";
import {
  unknownResolutionPath,
  unknownResolutionBody,
  mapUnknownResolution,
} from "../unknown-resolution.ts";
import { tenantPolicyPath, tenantPolicyScope } from "../tenant-policy.ts";
import { credentialMonitorPath, mapCredentialMonitorPage } from "../credential-monitor.ts";
import {
  emailEvidencePath,
  emailEvidenceBody,
  mapEmailEvidencePage,
  mapEmailEvidenceCurrent,
} from "../email-evidence.ts";
import { monitoringExportPath } from "./monitoring-export-mapper.ts";
import {
  senderBindingsPath,
  senderBindingPath,
  mapSenderBindingPage,
  mapSenderBinding,
  senderBindingMutationRequest,
  mapSenderBindingMutation,
} from "./sender-binding-mapper.ts";
import {
  providerRoutesPath,
  providerRoutePath,
  tenantRoutePath,
  senderRoutePath,
  mapProviderRoutePage,
  mapProviderRoute,
  mapTenantRouteAssignment,
  mapSenderRouteAssignment,
  providerRouteMutationRequest,
  mapProviderRouteMutation,
} from "./provider-route-mapper.ts";
import {
  providerAccountMutationRequest,
  mapProviderAccountMutation,
} from "./provider-account-mutation-mapper.ts";
import {
  providerMonitorPath,
  providerMetadataPath,
  providerChecksPath,
  mapProviderHealthPage,
  mapProviderMetadata,
  mapProviderChecks,
} from "./provider-monitoring-mapper.ts";
import {
  mapProviderHealth,
  smsPilotControlPath,
  mapSmsPilotControl,
} from "./provider-monitoring-mapper.ts";
import {
  webhookBasePath,
  webhookItemPath,
  webhookHistoryQuery,
  webhookMutationRequest,
  mapRegisteredWebhooks,
  mapRegisteredWebhook,
  mapWebhookHistory,
  mapWebhookMutation,
} from "./webhook-registry-mapper.ts";
import {
  applicationMutationRequest,
  mapMutatedApplication,
} from "./application-mutation-mapper.ts";
import {
  credentialBasePath,
  credentialItemPath,
  credentialQueryString,
  credentialIssueBody,
  credentialRevokeBody,
  mapCredentialMetadata,
  mapCredentialRegistryPage,
  mapIssuedRegistryCredential,
} from "./credential-registry-mapper.ts";
import {
  auditBasePath,
  auditDetailPath,
  auditQueryString,
  mapAdministrativeAudit,
  mapAdministrativeAuditPage,
  mapAuditRetention,
  auditRetentionRequest,
} from "./administrative-audit-mapper.ts";
import { usageReportPath, mapUsageReport } from "./usage-report-mapper.ts";
import {
  registryPath,
  registryItemPath,
  registryQueryString,
  mapRegistryTemplate,
  mapRegistryPage,
  registerTemplateRequest,
  evidenceRequest,
} from "./template-registry-mapper.ts";
import {
  bulkHistoryPath,
  bulkHistoryQueryString,
  bulkHistoryUuid,
  mapBulkHistoryJob,
  mapBulkHistoryItem,
  mapBulkHistoryPage,
} from "./bulk-job-history-mapper.ts";
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
  mapSenderIdentity,
  mapSenderIdentityPage,
  mapPlatformSenderIdentityPage,
  platformSenderIdentityListPath,
  senderIdentityDetailPath,
  senderIdentityListPath,
  SenderIdentityRequestError,
} from "./sender-identity-mapper.ts";
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
 * Live portal API. Connected operations use the engine; unsupported operations
 * reject with `LiveApiNotConnectedError` and never substitute mock data.
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
      if (property === 'listNotifications') return async (page: number) => mapNotificationPage(await http.get(`/notifications?page=${notificationPageNumber(page)}`), page);
      if (property === 'markNotificationRead') return async (id: string) => mapNotificationRead(await http.patch(`/notifications/${notificationId(id)}/read`, {}), id);
      if (property === 'markAllNotificationsRead') return async () => mapNotificationsReadAll(await http.patch('/notifications/read-all', {}));
      if (property === "listContentTemplates")
        return async (
          ...[actor, query, tenant]: Parameters<DolfConnectApi["listContentTemplates"]>
        ) =>
          mapContentTemplatePage(
            await http.get(contentTemplatePath(actor, tenant) + contentTemplateQuery(query)),
            contentTemplateScope(actor, tenant),
            query,
          );
      if (property === "getContentTemplate")
        return async (...[actor, id, tenant]: Parameters<DolfConnectApi["getContentTemplate"]>) =>
          mapContentTemplateDetail(
            await http.get(contentTemplatePath(actor, tenant, id)),
            contentTemplateScope(actor, tenant),
            id,
          );
      if (property === "applyContentTemplateMutation")
        return async (
          ...[actor, operation, tenant]: Parameters<DolfConnectApi["applyContentTemplateMutation"]>
        ) => {
          const request = contentTemplateMutation(actor, operation, tenant);
          return mapContentTemplateDetail(
            await http.post(request.path, request.body),
            contentTemplateScope(actor, tenant),
            operation.kind === "create" ? undefined : operation.id,
          );
        };
      if (property === "renderContentTemplate")
        return async (
          ...[actor, id, parameters, tenant]: Parameters<DolfConnectApi["renderContentTemplate"]>
        ) =>
          mapRenderedContent(
            await http.post(
              contentTemplatePath(actor, tenant, id) + "/render",
              contentTemplateRenderBody(parameters),
            ),
            id,
          );
      if (property === "createHumanBulkJob")
        return async (
          ...[actor, app, input, key, tenant]: Parameters<DolfConnectApi["createHumanBulkJob"]>
        ) =>
          mapHumanBulkReceipt(
            await http.post(
              humanBulkPath(actor, app, tenant) + ("csv" in input ? "/csv" : ""),
              "csv" in input ? humanBulkCsvBody(input) : humanBulkBody(input),
              {
                idempotencyKey: humanMessageIdempotencyKey(key),
              },
            ),
            actor,
            app,
            tenant,
          );
      if (property === "cancelHumanBulkJob")
        return async (...[actor, selection]: Parameters<DolfConnectApi["cancelHumanBulkJob"]>) =>
          mapBulkCancellation(
            await http.post(bulkCancellationPath(actor, selection), { confirm: true }),
            selection,
          );
      if (property === "listSenderBindings")
        return async (...[actor, query]: Parameters<DolfConnectApi["listSenderBindings"]>) =>
          mapSenderBindingPage(await http.get(senderBindingsPath(actor, query)), query);
      if (property === "getSenderBinding")
        return async (
          ...[actor, id, tenant, account]: Parameters<DolfConnectApi["getSenderBinding"]>
        ) => mapSenderBinding(await http.get(senderBindingPath(actor, id)), tenant, account, id);
      if (property === "applySenderBindingMutation")
        return async (
          ...[actor, operation]: Parameters<DolfConnectApi["applySenderBindingMutation"]>
        ) => {
          const request = senderBindingMutationRequest(actor, operation);
          return mapSenderBindingMutation(await http.post(request.path, request.body), operation);
        };
      if (property === "listProviderRoutes")
        return async (...[actor, query]: Parameters<DolfConnectApi["listProviderRoutes"]>) =>
          mapProviderRoutePage(await http.get(providerRoutesPath(actor, query)), query);
      if (property === "getProviderRoute")
        return async (...[actor, id]: Parameters<DolfConnectApi["getProviderRoute"]>) =>
          mapProviderRoute(await http.get(providerRoutePath(actor, id)), id);
      if (property === "getTenantRouteAssignment")
        return async (
          ...[actor, tenant, channel]: Parameters<DolfConnectApi["getTenantRouteAssignment"]>
        ) => {
          try {
            return mapTenantRouteAssignment(
              await http.get(tenantRoutePath(actor, tenant, channel)),
              tenant,
              channel,
            );
          } catch (error) {
            if (error instanceof ApiError && error.statusCode === 404) return null;
            throw error;
          }
        };
      if (property === "getSenderRouteAssignment")
        return async (
          ...[actor, tenant, sender]: Parameters<DolfConnectApi["getSenderRouteAssignment"]>
        ) => {
          try {
            return mapSenderRouteAssignment(
              await http.get(senderRoutePath(actor, tenant, sender)),
              tenant,
              sender,
            );
          } catch (error) {
            if (error instanceof ApiError && error.statusCode === 404) return null;
            throw error;
          }
        };
      if (property === "applyProviderRouteMutation")
        return async (
          ...[actor, operation]: Parameters<DolfConnectApi["applyProviderRouteMutation"]>
        ) => {
          const request = providerRouteMutationRequest(actor, operation);
          return mapProviderRouteMutation(await http.post(request.path, request.body), operation);
        };
      if (property === "applyProviderAccountMutation")
        return async (
          ...[actor, operation]: Parameters<DolfConnectApi["applyProviderAccountMutation"]>
        ) => {
          const request = providerAccountMutationRequest(actor, operation);
          return mapProviderAccountMutation(await http.post(request.path, request.body), operation);
        };
      if (property === "getProviderObservedHealth")
        return async (...[actor, id]: Parameters<DolfConnectApi["getProviderObservedHealth"]>) => {
          const result = mapProviderHealth(
            await http.get(`${providerMetadataPath(actor, id)}/health`),
          );
          if (result.providerAccountId !== id) throw new Error("Provider health account mismatch");
          return result;
        };
      if (property === "getEmailEvidence")
        return async (
          ...[actor, tenant, sender, page]: Parameters<DolfConnectApi["getEmailEvidence"]>
        ) =>
          mapEmailEvidencePage(
            await http.get(emailEvidencePath(actor, tenant, sender, page)),
            tenant,
            sender,
            page,
          );
      if (property === "getProviderAttempts")
        return async (
          ...[actor, tenant, message]: Parameters<DolfConnectApi["getProviderAttempts"]>
        ) =>
          mapProviderAttempts(
            await http.get(providerAttemptsPath(actor, tenant, message)),
            message,
          );
      if (property === "submitHumanMessage")
        return async (
          ...[actor, app, input, key, tenant]: Parameters<DolfConnectApi["submitHumanMessage"]>
        ) =>
          mapHumanMessageAcceptance(
            await http.post(humanMessagePath(actor, app, tenant), humanMessageBody(input), {
              idempotencyKey: humanMessageIdempotencyKey(key),
            }),
            input.channel,
          );
      if (property === "resolveUnknownMessage")
        return async (
          ...[actor, tenant, message, input]: Parameters<DolfConnectApi["resolveUnknownMessage"]>
        ) =>
          mapUnknownResolution(
            await http.post(
              unknownResolutionPath(actor, tenant, message),
              unknownResolutionBody(input),
            ),
            message,
            input.decision,
          );
      if (property === "recordEmailEvidence")
        return async (
          ...[actor, tenant, sender, input]: Parameters<DolfConnectApi["recordEmailEvidence"]>
        ) =>
          mapEmailEvidenceCurrent(
            await http.post(emailEvidencePath(actor, tenant, sender), emailEvidenceBody(input)),
            tenant,
            sender,
            input,
          );
      if (property === "listCredentialMonitor")
        return async (...[actor, query]: Parameters<DolfConnectApi["listCredentialMonitor"]>) =>
          mapCredentialMonitorPage(await http.get(credentialMonitorPath(actor, query)), query);
      if (property === "getTenantPolicy")
        return async (...[actor, tenant]: Parameters<DolfConnectApi["getTenantPolicy"]>) =>
          mapTenantSubscriptionView(
            await http.get(tenantPolicyPath(actor, tenant)),
            tenantPolicyScope(actor, tenant),
          );
      if (property === "getSmsPilotControl")
        return async (...[actor]: Parameters<DolfConnectApi["getSmsPilotControl"]>) =>
          mapSmsPilotControl(await http.get(smsPilotControlPath(actor)));
      if (property === "listProviderMonitoring")
        return async (...[actor, query]: Parameters<DolfConnectApi["listProviderMonitoring"]>) =>
          mapProviderHealthPage(await http.get(providerMonitorPath(actor, query)), query);
      if (property === "getProviderMetadata")
        return async (...[actor, id]: Parameters<DolfConnectApi["getProviderMetadata"]>) =>
          mapProviderMetadata(await http.get(providerMetadataPath(actor, id)), id);
      if (property === "listProviderRecordedChecks")
        return async (
          ...[actor, id, query]: Parameters<DolfConnectApi["listProviderRecordedChecks"]>
        ) => mapProviderChecks(await http.get(providerChecksPath(actor, id, query)), id, query);
      if (property === "downloadMonitoringCsv")
        return async (
          ...[actor, request, tenant]: Parameters<DolfConnectApi["downloadMonitoringCsv"]>
        ) => http.getCsv(monitoringExportPath(actor, request, tenant));
      if (property === "applyLiveSenderMutation")
        return async (
          ...[actor, operation, tenant]: Parameters<DolfConnectApi["applyLiveSenderMutation"]>
        ) => {
          const request = senderMutationRequest(actor, operation, tenant);
          return mapSenderMutation(
            await http.post(request.path, request.body),
            actor,
            operation,
            tenant,
          );
        };
      if (property === "listWebhookRegistry")
        return async (...[actor, app, tenant]: Parameters<DolfConnectApi["listWebhookRegistry"]>) =>
          mapRegisteredWebhooks(await http.get(webhookBasePath(actor, app, tenant)), app);
      if (property === "getWebhookRegistry")
        return async (
          ...[actor, app, id, tenant]: Parameters<DolfConnectApi["getWebhookRegistry"]>
        ) => mapRegisteredWebhook(await http.get(webhookItemPath(actor, app, id, tenant)), app, id);
      if (property === "listWebhookDeliveries")
        return async (
          ...[actor, app, id, query, tenant]: Parameters<DolfConnectApi["listWebhookDeliveries"]>
        ) =>
          mapWebhookHistory(
            await http.get(
              `${webhookItemPath(actor, app, id, tenant)}/deliveries?${webhookHistoryQuery(query)}`,
            ),
            query,
          );
      if (property === "applyWebhookRegistryMutation")
        return async (
          ...[actor, app, operation, tenant]: Parameters<
            DolfConnectApi["applyWebhookRegistryMutation"]
          >
        ) => {
          const request = webhookMutationRequest(actor, app, operation, tenant);
          const result =
            request.method === "delete"
              ? await http.delete(request.path)
              : await http[request.method](request.path, request.body);
          return mapWebhookMutation(result, app, operation);
        };
      if (property === "applyLiveApplicationMutation") {
        return async (
          ...[actor, operation, tenantId]: Parameters<
            DolfConnectApi["applyLiveApplicationMutation"]
          >
        ) => {
          const request = applicationMutationRequest(actor, operation, tenantId);
          return mapMutatedApplication(
            await http[request.method](request.path, request.body),
            actor,
            operation,
            tenantId,
          );
        };
      }
      if (property === "listCredentialRegistry") {
        return async (
          ...[actor, applicationId, query, tenantId]: Parameters<
            DolfConnectApi["listCredentialRegistry"]
          >
        ) =>
          mapCredentialRegistryPage(
            await http.get(
              `${credentialBasePath(actor, applicationId, tenantId)}?${credentialQueryString(query)}`,
            ),
            actor,
            applicationId,
            query,
            tenantId,
          );
      }
      if (property === "getCredentialRegistry") {
        return async (
          ...[actor, applicationId, id, tenantId]: Parameters<
            DolfConnectApi["getCredentialRegistry"]
          >
        ) =>
          mapCredentialMetadata(
            await http.get(credentialItemPath(actor, applicationId, id, tenantId)),
            actor,
            applicationId,
            tenantId,
            id,
          );
      }
      if (property === "issueRegistryCredential") {
        return async (
          ...[actor, applicationId, input, tenantId]: Parameters<
            DolfConnectApi["issueRegistryCredential"]
          >
        ) =>
          mapIssuedRegistryCredential(
            await http.post(
              credentialBasePath(actor, applicationId, tenantId),
              credentialIssueBody(input),
            ),
            actor,
            applicationId,
            tenantId,
          );
      }
      if (property === "rotateRegistryCredential") {
        return async (
          ...[actor, applicationId, id, input, tenantId]: Parameters<
            DolfConnectApi["rotateRegistryCredential"]
          >
        ) =>
          mapIssuedRegistryCredential(
            await http.post(
              `${credentialItemPath(actor, applicationId, id, tenantId)}/rotate`,
              credentialIssueBody(input),
            ),
            actor,
            applicationId,
            tenantId,
            id,
          );
      }
      if (property === "revokeRegistryCredential") {
        return async (
          ...[actor, applicationId, id, reason, tenantId]: Parameters<
            DolfConnectApi["revokeRegistryCredential"]
          >
        ) =>
          mapCredentialMetadata(
            await http.post(
              `${credentialItemPath(actor, applicationId, id, tenantId)}/revoke`,
              credentialRevokeBody(reason),
            ),
            actor,
            applicationId,
            tenantId,
            id,
          );
      }
      if (property === "listAdministrativeAudit") {
        return async (
          actor: Parameters<DolfConnectApi["listAdministrativeAudit"]>[0],
          query: Parameters<DolfConnectApi["listAdministrativeAudit"]>[1],
          tenantId?: string,
        ) =>
          mapAdministrativeAuditPage(
            await http.get(`${auditBasePath(actor, tenantId)}?${auditQueryString(query)}`),
            query,
            actor.role === "super_admin" ? tenantId : (actor.tenantId ?? undefined),
          );
      }
      if (property === "getAdministrativeAudit") {
        return async (
          actor: Parameters<DolfConnectApi["getAdministrativeAudit"]>[0],
          id: string,
          tenantId?: string,
        ) => {
          const row = mapAdministrativeAudit(
            await http.get(auditDetailPath(actor, id, tenantId)),
            actor.role === "super_admin" ? tenantId : (actor.tenantId ?? undefined),
          );
          if (row.id !== id) throw new Error("Audit detail identity mismatch");
          return row;
        };
      }
      if (property === "getAuditRetention") {
        return async (actor: Parameters<DolfConnectApi["getAuditRetention"]>[0]) => {
          if (actor.role !== "super_admin") throw new Error("Platform context required");
          return mapAuditRetention(await http.get("/platform/audit-retention"));
        };
      }
      if (property === "updateAuditRetention") {
        return async (actor: Parameters<DolfConnectApi["updateAuditRetention"]>[0], days: number) =>
          mapAuditRetention(
            await http.patch("/platform/audit-retention", auditRetentionRequest(actor, days)),
          );
      }
      if (property === "getUsageReport") {
        return async (
          actor: Parameters<DolfConnectApi["getUsageReport"]>[0],
          range: Parameters<DolfConnectApi["getUsageReport"]>[1],
          tenantId?: string,
        ) => mapUsageReport(await http.get(usageReportPath(actor, range, tenantId)), range);
      }
      if (property === "listTemplateRegistry") {
        return async (
          actor: Parameters<DolfConnectApi["listTemplateRegistry"]>[0],
          query: Parameters<DolfConnectApi["listTemplateRegistry"]>[1],
          tenantId?: string,
        ) =>
          mapRegistryPage(
            await http.get(`${registryPath(actor, tenantId)}?${registryQueryString(query)}`),
            actor,
            tenantId,
          );
      }
      if (property === "getTemplateRegistry") {
        return async (
          actor: Parameters<DolfConnectApi["getTemplateRegistry"]>[0],
          id: string,
          tenantId?: string,
        ) =>
          mapRegistryTemplate(
            await http.get(registryItemPath(actor, id, tenantId)),
            actor,
            tenantId,
            id,
          );
      }
      if (property === "registerTemplate") {
        return async (
          actor: Parameters<DolfConnectApi["registerTemplate"]>[0],
          input: Parameters<DolfConnectApi["registerTemplate"]>[1],
          tenantId?: string,
        ) =>
          mapRegistryTemplate(
            await http.post(registryPath(actor, tenantId), registerTemplateRequest(input)),
            actor,
            tenantId,
          );
      }
      if (property === "changeTemplateRegistry") {
        return async (
          actor: Parameters<DolfConnectApi["changeTemplateRegistry"]>[0],
          id: string,
          action: "ready" | "retire",
          tenantId?: string,
        ) => {
          if (action !== "ready" && action !== "retire")
            throw new Error("Invalid template registry action");
          return mapRegistryTemplate(
            await http.post(`${registryItemPath(actor, id, tenantId)}/${action}`, {}),
            actor,
            tenantId,
            id,
          );
        };
      }
      if (property === "recordTemplateEvidence") {
        return async (
          actor: Parameters<DolfConnectApi["recordTemplateEvidence"]>[0],
          id: string,
          input: Parameters<DolfConnectApi["recordTemplateEvidence"]>[2],
          tenantId?: string,
        ) =>
          mapRegistryTemplate(
            await http.post(
              `${registryItemPath(actor, id, tenantId)}/evidence`,
              evidenceRequest(actor, input),
            ),
            actor,
            tenantId,
            id,
          );
      }
      if (property === "listBulkJobHistory") {
        return async (
          actor: Parameters<DolfConnectApi["listBulkJobHistory"]>[0],
          query: Parameters<DolfConnectApi["listBulkJobHistory"]>[1],
          tenantId?: string,
        ) =>
          mapBulkHistoryPage(
            await http.get(
              `${bulkHistoryPath(actor.role, tenantId)}?${bulkHistoryQueryString(query)}`,
            ),
            (row) => mapBulkHistoryJob(row),
          );
      }
      if (property === "listAllTenantBulkJobHistory") {
        return async (
          actor: Parameters<DolfConnectApi["listAllTenantBulkJobHistory"]>[0],
          query: Parameters<DolfConnectApi["listAllTenantBulkJobHistory"]>[1],
        ) =>
          mapBulkHistoryPage(
            await http.get(
              `${bulkHistoryPath(actor.role, undefined, true)}?${bulkHistoryQueryString(query)}`,
            ),
            (row) => mapBulkHistoryJob(row, true),
          );
      }
      if (property === "getBulkJobHistory") {
        return async (
          actor: Parameters<DolfConnectApi["getBulkJobHistory"]>[0],
          id: string,
          tenantId?: string,
        ) =>
          mapBulkHistoryJob(
            await http.get(`${bulkHistoryPath(actor.role, tenantId)}/${bulkHistoryUuid(id)}`),
            false,
            true,
          );
      }
      if (property === "listBulkJobHistoryItems") {
        return async (
          actor: Parameters<DolfConnectApi["listBulkJobHistoryItems"]>[0],
          id: string,
          query: Parameters<DolfConnectApi["listBulkJobHistoryItems"]>[2],
          tenantId?: string,
        ) =>
          mapBulkHistoryPage(
            await http.get(
              `${bulkHistoryPath(actor.role, tenantId)}/${bulkHistoryUuid(id)}/items?${bulkHistoryQueryString(query)}`,
            ),
            mapBulkHistoryItem,
          );
      }
      if (property === "getDashboard") {
        return async () => mapDashboardSummary(await http.get("/dashboard"));
      }
      if (property === "getDashboardMessages") {
        return async () => mapDashboardMessages(await http.get("/dashboard/messages"));
      }
      if (property === "getDashboardQuota") {
        return async () => mapDashboardQuota(await http.get("/dashboard/quota"));
      }
      if (property === "listSenderIdentityReadPage") {
        return async (
          actor: Parameters<DolfConnectApi["listSenderIdentityReadPage"]>[0],
          query: Parameters<DolfConnectApi["listSenderIdentityReadPage"]>[1],
          tenantId?: string,
        ) =>
          mapSenderIdentityPage(
            await http.get(
              senderIdentityListPath(
                actor.role,
                query.page ?? 1,
                query.pageSize ?? 20,
                query.filters,
                actor.role === "super_admin" ? tenantId : undefined,
              ),
            ),
          );
      }
      if (property === "listAllTenantSenderIdentityReadPage") {
        return async (
          actor: Parameters<DolfConnectApi["listAllTenantSenderIdentityReadPage"]>[0],
          query: Parameters<DolfConnectApi["listAllTenantSenderIdentityReadPage"]>[1],
        ) => {
          if (actor.role !== "super_admin") {
            throw new SenderIdentityRequestError(
              "Platform sender identities require a platform administrator.",
            );
          }
          return mapPlatformSenderIdentityPage(
            await http.get(
              platformSenderIdentityListPath(
                query.page ?? 1,
                query.pageSize ?? 20,
                query.filters,
              ),
            ),
          );
        };
      }
      if (property === "getSenderIdentityRead") {
        return async (
          actor: Parameters<DolfConnectApi["getSenderIdentityRead"]>[0],
          id: string,
          tenantId?: string,
        ) => {
          try {
            return mapSenderIdentity(
              await http.get(
                senderIdentityDetailPath(
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
                query,
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
              platformApplicationListPath(query.page ?? 1, query.pageSize ?? 20, query),
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
