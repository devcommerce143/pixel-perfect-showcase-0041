import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api } from "./client";
import type { ApiCredentialListQuery, ApplicationListQuery, BulkJobListQuery, BulkSuppressionCandidate, Channel, CreateBulkJobInput, ListParams, PlatformApiClientListQuery, SenderIdentityActor, SenderIdentityListQuery, TenantListQuery, TemplateListQuery, TenantUsageTableQuery, UserListQuery } from "./types";

/** Query layer: screens consume these factories, never the API client directly. */
export const queries = {
  dashboard: () => queryOptions({ queryKey: ["dashboard"], queryFn: () => api.getDashboard() }),
  messages: (p: ListParams, actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["messages", actor.role, actor.tenantId, p],
      queryFn: () => api.listMessages(p, actor),
      placeholderData: keepPreviousData,
    }),
  message: (id: string, actor: SenderIdentityActor, tenantId?: string) => queryOptions({ queryKey: ["message", actor.role, actor.tenantId, tenantId, id], queryFn: () => api.getMessage(id, actor, tenantId) }),
  templates: (p: TemplateListQuery, actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["templates", actor.role, actor.tenantId, p],
      queryFn: () => api.listTemplates(p, actor),
      placeholderData: keepPreviousData,
    }),
  applications: (actor: SenderIdentityActor, tenantId?: string) => queryOptions({ queryKey: ["applications", actor.role, actor.tenantId, tenantId], queryFn: () => api.listApplications(actor, tenantId) }),
  applicationsPage: (actor: SenderIdentityActor, query: ApplicationListQuery) => queryOptions({ queryKey: ["applicationsPage", actor.role, actor.tenantId, query], queryFn: () => api.listApplicationsPage(actor, query), placeholderData: keepPreviousData }),
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
  providers: () => queryOptions({ queryKey: ["providers"], queryFn: () => api.listProviders() }),
  providerUsageBilling: (actor: SenderIdentityActor, providerId?: string) => queryOptions({
    queryKey: ["providerUsageBilling", actor.role, providerId],
    queryFn: () => providerId ? api.getProviderUsageBilling(actor, providerId) : Promise.resolve(null),
    enabled: actor.role === "super_admin" && !!providerId,
  }),
  senderIdentities: (actor: SenderIdentityActor, query: SenderIdentityListQuery) =>
    queryOptions({ queryKey: ["senderIdentities", actor.role, actor.tenantId, query], queryFn: () => api.listSenderIdentities(actor, query), placeholderData: keepPreviousData }),
  sendableSenderIdentities: (actor: SenderIdentityActor, applicationId: string, channel: Channel) =>
    queryOptions({ queryKey: ["sendableSenderIdentities", actor.role, actor.tenantId, applicationId, channel], enabled: !!applicationId, queryFn: () => api.listSendableSenderIdentities(actor, applicationId, channel) }),
  bulkJobs: (actor: SenderIdentityActor, query: BulkJobListQuery) => queryOptions({ queryKey: ["bulkJobs", actor.role, actor.tenantId, query], queryFn: () => api.listBulkJobs(actor, query), placeholderData: keepPreviousData }),
  bulkJob: (actor: SenderIdentityActor, id: string, tenantId?: string) => queryOptions({ queryKey: ["bulkJob", actor.role, actor.tenantId, tenantId, id], enabled: !!id, queryFn: () => api.getBulkJob(actor, id, tenantId) }),
  bulkTemplates: (actor: SenderIdentityActor, applicationId: string, channel: Channel) => queryOptions({ queryKey: ["bulkTemplates", actor.role, actor.tenantId, applicationId, channel], enabled: !!applicationId, queryFn: () => api.listBulkTemplates(actor, applicationId, channel) }),
  webhooks: () => queryOptions({ queryKey: ["webhooks"], queryFn: () => api.listWebhooks() }),
  users: (actor: SenderIdentityActor, query: UserListQuery) => queryOptions({ queryKey: ["users", actor.role, actor.tenantId, query], queryFn: () => api.listUsers(actor, query), placeholderData: keepPreviousData }),
  settings: () => queryOptions({ queryKey: ["settings"], queryFn: () => api.getSettings() }),
  report: (actor: SenderIdentityActor, tenantId?: string) => queryOptions({ queryKey: ["report", actor.role, actor.tenantId, tenantId], queryFn: () => api.getReport(actor, tenantId) }),
  plans: () => queryOptions({ queryKey: ["plans"], queryFn: () => api.listPlans() }),
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
