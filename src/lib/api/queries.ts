import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type {
  ApiCredentialListQuery,
  ApplicationListQuery,
  BulkJobListQuery,
  BulkSuppressionCandidate,
  Channel,
  CreateBulkJobInput,
  ListParams,
  MessageHistoryQuery,
  PlanListQuery,
  PlatformApiClientListQuery,
  SenderIdentityActor,
  SenderIdentityListQuery,
  TenantListQuery,
  TenantSubscriptionHistoryQuery,
  TemplateListQuery,
  TenantUsageTableQuery,
  UserListQuery,
} from "./types";
import { tenantOptionsQueryOptions } from "./tenant-options";
import { fetchCompleteTenantAssignmentPlans } from "./tenant-assignment-plans";
import { isTenantUuid } from "./http/tenant-mapper";
import {
  tenantSubscriptionHistoryQueryKey,
  tenantSubscriptionQueryKey,
} from "./http/tenant-subscription-mapper";
import {
  allTenantMessageHistoryQueryKey,
  tenantMessageHistoryQueryKey,
} from "./message-history-query-keys";
import {
  allTenantApplicationPageQueryKey,
  applicationReadQueryOptions,
  applicationDetailQueryKey,
  applicationPageQueryKey,
} from "./application-query-keys";
import {
  allTenantSenderIdentityPageQueryKey,
  senderIdentityDetailQueryKey,
  senderIdentityPageQueryKey,
  senderIdentityScopeIsAvailable,
} from "./sender-identity-query-keys";

/** Query layer: screens consume these factories, never the API client directly. */
export const queries = {
  dashboard: () => queryOptions({ queryKey: ["dashboard"], queryFn: () => api.getDashboard() }),
  dashboardMessages: () => queryOptions({ queryKey: ["dashboard", "messages"], queryFn: () => api.getDashboardMessages() }),
  dashboardQuota: () => queryOptions({ queryKey: ["dashboard", "quota"], queryFn: () => api.getDashboardQuota() }),
  messages: (p: ListParams, actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["messages", actor.role, actor.tenantId, p],
      queryFn: () => api.listMessages(p, actor),
      placeholderData: keepPreviousData,
    }),
  messageHistory: (query: MessageHistoryQuery | null, actor: SenderIdentityActor, tenantId?: string, enabled = true) =>
    queryOptions({
      queryKey: tenantMessageHistoryQueryKey(query, actor, tenantId),
      queryFn: () => {
        if (!query) throw new Error("A valid message history date range is required.");
        return api.listMessageHistory(query, actor, tenantId);
      },
      enabled: enabled && query !== null,
    }),
  allTenantMessageHistory: (query: MessageHistoryQuery | null, actor: SenderIdentityActor, enabled = true) =>
    queryOptions({
      queryKey: allTenantMessageHistoryQueryKey(query, actor),
      queryFn: () => {
        if (!query) throw new Error("A valid message history date range is required.");
        return api.listAllTenantMessageHistory(query, actor);
      },
      enabled: enabled && actor.role === "super_admin" && query !== null,
    }),
  messageHistoryDetail: (id: string, actor: SenderIdentityActor, tenantId?: string, enabled = true) =>
    queryOptions({
      queryKey: ["messageHistoryDetail", actor.role, actor.tenantId, tenantId, id],
      queryFn: () => api.getMessageHistory(id, actor, tenantId),
      enabled: enabled && !!id,
    }),
  message: (id: string, actor: SenderIdentityActor, tenantId?: string) => queryOptions({ queryKey: ["message", actor.role, actor.tenantId, tenantId, id], queryFn: () => api.getMessage(id, actor, tenantId) }),
  templates: (p: TemplateListQuery, actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["templates", actor.role, actor.tenantId, p],
      queryFn: () => api.listTemplates(p, actor),
      placeholderData: keepPreviousData,
    }),
  applications: (actor: SenderIdentityActor, tenantId?: string) => queryOptions({ queryKey: ["applications", actor.role, actor.tenantId, tenantId], queryFn: () => api.listApplications(actor, tenantId) }),
  applicationsPage: (
    actor: SenderIdentityActor,
    query: ApplicationListQuery,
    tenantId?: string,
    enabled = true,
    isLive = false,
  ) =>
    queryOptions(applicationReadQueryOptions(
      applicationPageQueryKey(actor, query, tenantId),
      () => api.listApplicationsPage(actor, query, actor.role === "super_admin" ? tenantId : undefined),
      enabled && (!isLive || actor.role !== "super_admin" || !!tenantId),
    )),
  allTenantApplicationsPage: (
    actor: SenderIdentityActor,
    query: ApplicationListQuery,
    enabled = true,
  ) =>
    queryOptions(applicationReadQueryOptions(
      allTenantApplicationPageQueryKey(actor, query),
      () => {
        if (actor.role !== "super_admin") {
          throw new Error("Platform applications require a platform administrator.");
        }
        return api.listAllTenantApplications(actor, query);
      },
      enabled && actor.role === "super_admin",
    )),
  application: (actor: SenderIdentityActor, id: string, tenantId?: string, enabled = true) =>
    queryOptions(applicationReadQueryOptions(
      applicationDetailQueryKey(actor, id, tenantId),
      () => api.getApplication(actor, id, actor.role === "super_admin" ? tenantId : undefined),
      enabled && !!id && (actor.role !== "super_admin" || !!tenantId),
    )),
  credentials: (actor: SenderIdentityActor, query: ApiCredentialListQuery) => queryOptions({ queryKey: ["credentials", actor.role, actor.tenantId, query], queryFn: () => api.listCredentials(actor, query), placeholderData: keepPreviousData }),
  audit: (p: ListParams, actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["audit", actor.role, actor.tenantId, p],
      queryFn: () => api.listAuditEvents(p, actor),
      placeholderData: keepPreviousData,
    }),
  usage: (actor: SenderIdentityActor, tenantId?: string, tableQuery?: TenantUsageTableQuery) =>
    queryOptions({ queryKey: ["usage", actor.role, actor.tenantId, tenantId, tableQuery], queryFn: () => api.getUsage(actor, tenantId, tableQuery) }),
  tenants: (p: TenantListQuery) =>
    queryOptions({
      queryKey: ["tenants", p],
      queryFn: () => api.listTenants(p),
      placeholderData: keepPreviousData,
    }),
  tenant: (tenantId: string) =>
    queryOptions({
      queryKey: ["tenants", "detail", tenantId],
      queryFn: () => api.getTenant(tenantId),
      enabled: isTenantUuid(tenantId),
    }),
  tenantSubscription: (tenantId: string, enabled = true) =>
    queryOptions({
      queryKey: tenantSubscriptionQueryKey(tenantId),
      queryFn: () => api.getTenantSubscription(tenantId),
      enabled: isTenantUuid(tenantId) && enabled,
    }),
  tenantSubscriptionHistory: (
    tenantId: string,
    query: TenantSubscriptionHistoryQuery,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: tenantSubscriptionHistoryQueryKey(tenantId, query),
      queryFn: () => api.getTenantSubscriptionHistory(tenantId, query),
      enabled: isTenantUuid(tenantId) && enabled,
    }),
  tenantOptions: () => tenantOptionsQueryOptions((query) => api.listTenants(query)),
  tenantAssignmentPlans: (enabled = true) =>
    queryOptions({
      queryKey: ["plans", "tenant-assignment-options"],
      queryFn: () => fetchCompleteTenantAssignmentPlans((query) => api.listPlans(query)),
      enabled,
    }),
  providers: () => queryOptions({ queryKey: ["providers"], queryFn: () => api.listProviders() }),
  providerUsageBilling: (actor: SenderIdentityActor, providerId?: string) => queryOptions({
    queryKey: ["providerUsageBilling", actor.role, providerId],
    queryFn: () => providerId ? api.getProviderUsageBilling(actor, providerId) : Promise.resolve(null),
    enabled: actor.role === "super_admin" && !!providerId,
  }),
  senderIdentities: (actor: SenderIdentityActor, query: SenderIdentityListQuery) =>
    queryOptions({ queryKey: ["senderIdentities", actor.role, actor.tenantId, query], queryFn: () => api.listSenderIdentities(actor, query), placeholderData: keepPreviousData }),
  senderIdentityReadPage: (
    actor: SenderIdentityActor,
    query: SenderIdentityListQuery,
    tenantId?: string,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: senderIdentityPageQueryKey(actor, query, tenantId),
      queryFn: () => api.listSenderIdentityReadPage(actor, query, tenantId),
      enabled:
        enabled &&
        senderIdentityScopeIsAvailable(actor.role, tenantId),
    }),
  allTenantSenderIdentityReadPage: (
    actor: SenderIdentityActor,
    query: SenderIdentityListQuery,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: allTenantSenderIdentityPageQueryKey(actor, query),
      queryFn: () => {
        if (actor.role !== "super_admin") {
          throw new Error(
            "Platform sender identities require a platform administrator.",
          );
        }
        return api.listAllTenantSenderIdentityReadPage(actor, query);
      },
      enabled: enabled && actor.role === "super_admin",
    }),
  senderIdentityRead: (
    actor: SenderIdentityActor,
    id: string,
    tenantId?: string,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: senderIdentityDetailQueryKey(actor, id, tenantId),
      queryFn: () => api.getSenderIdentityRead(actor, id, tenantId),
      enabled:
        enabled &&
        !!id &&
        senderIdentityScopeIsAvailable(actor.role, tenantId),
    }),
  sendableSenderIdentities: (actor: SenderIdentityActor, applicationId: string, channel: Channel) =>
    queryOptions({ queryKey: ["sendableSenderIdentities", actor.role, actor.tenantId, applicationId, channel], enabled: !!applicationId, queryFn: () => api.listSendableSenderIdentities(actor, applicationId, channel) }),
  bulkJobs: (actor: SenderIdentityActor, query: BulkJobListQuery) => queryOptions({ queryKey: ["bulkJobs", actor.role, actor.tenantId, query], queryFn: () => api.listBulkJobs(actor, query), placeholderData: keepPreviousData }),
  bulkJob: (actor: SenderIdentityActor, id: string, tenantId?: string) => queryOptions({ queryKey: ["bulkJob", actor.role, actor.tenantId, tenantId, id], enabled: !!id, queryFn: () => api.getBulkJob(actor, id, tenantId) }),
  bulkTemplates: (actor: SenderIdentityActor, applicationId: string, channel: Channel) => queryOptions({ queryKey: ["bulkTemplates", actor.role, actor.tenantId, applicationId, channel], enabled: !!applicationId, queryFn: () => api.listBulkTemplates(actor, applicationId, channel) }),
  webhooks: () => queryOptions({ queryKey: ["webhooks"], queryFn: () => api.listWebhooks() }),
  users: (actor: SenderIdentityActor, query: UserListQuery, targetTenantId?: string) => queryOptions({ queryKey: ["users", actor.role, actor.tenantId, targetTenantId, query], queryFn: () => api.listUsers(actor, query, targetTenantId), placeholderData: keepPreviousData }),
  settings: () => queryOptions({ queryKey: ["settings"], queryFn: () => api.getSettings() }),
  report: (actor: SenderIdentityActor, tenantId?: string) => queryOptions({ queryKey: ["report", actor.role, actor.tenantId, tenantId], queryFn: () => api.getReport(actor, tenantId) }),
  plans: (query: PlanListQuery = {}) => queryOptions({ queryKey: ["plans", query], queryFn: () => api.listPlans(query), placeholderData: keepPreviousData }),
  channels: () => queryOptions({ queryKey: ["channels"], queryFn: () => api.listChannels() }),
  routing: () => queryOptions({ queryKey: ["routing"], queryFn: () => api.listRoutingRules() }),
  platformClients: (p: PlatformApiClientListQuery, actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["platformClients", actor.role, actor.tenantId, p],
      queryFn: () => api.listPlatformClients(p, actor),
      placeholderData: keepPreviousData,
    }),
  config: () => queryOptions({ queryKey: ["config"], queryFn: () => api.listConfig() }),
};

export const bulkMutations = {
  createJob: (actor: SenderIdentityActor, input: CreateBulkJobInput) => api.createBulkJob(actor, input),
  checkSuppression: (actor: SenderIdentityActor, applicationId: string, candidates: BulkSuppressionCandidate[]) => api.checkBulkSuppression(actor, applicationId, candidates),
};

export const templateMutations = {
  create: (actor: SenderIdentityActor, input: Pick<import("./types").Template, "name" | "channel" | "category" | "language" | "subject" | "body">) => api.createTemplate(actor, input),
  update: (actor: SenderIdentityActor, id: string, input: Pick<import("./types").Template, "name" | "channel" | "category" | "language" | "subject" | "body">) => api.updateTemplate(actor, id, input),
  submitForApproval: (actor: SenderIdentityActor, id: string) => api.submitTemplateForApproval(actor, id),
  activate: (actor: SenderIdentityActor, id: string) => api.activateTemplate(actor, id),
  deactivate: (actor: SenderIdentityActor, id: string) => api.deactivateTemplate(actor, id),
};
