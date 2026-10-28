import { deliveryDispatchControlKey, type DeliveryChannel } from "./delivery-dispatch-control";
import { webhookScopeKey, webhookHistoryKey } from "./webhook-registry";
import { smsDispatchControlKey } from "./sms-dispatch-control";
import { smsAutomationKey, type SmsAutomationInput } from "./sms-automation";
import { canResolveEntity, entityNameKey, humanName, type NamedEntity } from "./entity-names";
import { contentTemplateKey } from "./content-template";
import type { ContentTemplateQuery } from "./content-template";
import { tenantPolicyKey } from "./tenant-policy";
import { credentialMonitorKey } from "./credential-monitor";
import { emailEvidenceKey } from "./email-evidence";
import { providerAttemptsKey } from "./provider-attempts";
import { roleHas } from "../auth/permissions";
import { humanMessageKey } from "./human-message";
import { notificationKey } from './notifications';
import type { CredentialMonitorQuery } from "./credential-monitor";
import { providerMonitorKey } from "./provider-monitoring";
import { providerRouteKey } from "./provider-routes";
import { senderBindingKey } from "./sender-bindings";
import { readHistoryApplicationOptions } from "./history-application-options";
import type { SenderBindingQuery } from "./sender-bindings";
import type { ProviderRouteQuery, RouteChannel } from "./provider-routes";
import type { ProviderMonitorQuery } from "./provider-monitoring";
import type { WebhookHistoryQuery, WebhookRegistryOperation } from "./webhook-registry";
import { applicationMutationKey } from "./application-mutations";
import type { CredentialRegistryQuery, CredentialIssueInput } from "./credential-registry";
import { credentialScopeKey, credentialListKey } from "./credential-registry";
import type { AdministrativeAuditQuery } from "./administrative-audit";
import { administrativeAuditKey } from "./administrative-audit";
import type { UsageReportRange } from "./usage-report";
import { usageReportKey } from "./usage-report";
import type {
  RegistryQuery,
  RegisterTemplateInput,
  TemplateEvidenceInput,
} from "./template-registry";
import { registryListKey, registryDetailKey } from "./template-registry";
import type { BulkHistoryQuery, BulkHistoryItemsQuery } from "./bulk-job-history-types";
import {
  bulkHistoryListKey,
  bulkHistoryDetailKey,
  bulkHistoryItemsKey,
} from "./bulk-job-history-query-keys";
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
  messageHistoryDetailQueryKey,
  historyApplicationScope,
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
  notifications: (actor: SenderIdentityActor, page: number) =>
    queryOptions({
      queryKey: notificationKey(actor, page),
      queryFn: () => api.listNotifications(page),
      enabled: !!actor.userId,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    }),
  entityName: (
    actor: SenderIdentityActor,
    kind: NamedEntity,
    id: string,
    tenantId?: string,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: entityNameKey(actor, kind, id, tenantId),
      enabled: enabled && canResolveEntity(actor, kind, id, tenantId),
      staleTime: 60_000,
      retry: false,
      queryFn: async (): Promise<string | null> => {
        // Enforce scope even when refetch is invoked on a disabled query.
        if (!canResolveEntity(actor, kind, id, tenantId)) return null;
        const target = actor.role === "super_admin" ? tenantId : undefined;
        if (kind === "tenant") return humanName((await api.getTenant(id)).name);
        if (kind === "provider") return humanName((await api.getProviderMetadata(actor, id)).code);
        if (kind === "route") return humanName((await api.getProviderRoute(actor, id)).code);
        if (kind === "application")
          return humanName((await api.getApplication(actor, id, target))?.name);
        if (kind === "template")
          return humanName((await api.getTemplateRegistry(actor, id, target)).templateKey);
        const sender = await api.getSenderIdentityRead(actor, id, target);
        if (!sender) return null;
        return (
          humanName(sender.displayName) ??
          humanName(
            sender.channel === "sms"
              ? sender.sms.senderId
              : sender.channel === "email"
                ? sender.email.emailAddress
                : sender.whatsapp.businessDisplayName,
          )
        );
      },
    }),
  humanMessageApplications: (actor: SenderIdentityActor, page: number, tenantId?: string) =>
    queryOptions({
      queryKey: [...humanMessageKey(actor, tenantId), "applications", page],
      enabled: !!actor.userId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () =>
        api.listApplicationsPage(
          actor,
          { page, pageSize: 20, filters: { status: "active" } },
          tenantId,
        ),
    }),
  humanMessageSenders: (
    actor: SenderIdentityActor,
    channel: Channel,
    page: number,
    tenantId: string | undefined,
    applicationId: string,
  ) =>
    queryOptions({
      queryKey: [...humanMessageKey(actor, tenantId), "senders", applicationId, channel, page],
      enabled: !!actor.userId && !!applicationId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () =>
        api.listSenderIdentityReadPage(
          actor,
          {
            page,
            pageSize: 20,
            filters: { channel, verificationStatus: "verified", operationalStatus: "active" },
          },
          tenantId,
        ),
    }),
  providerAttempts: (actor: SenderIdentityActor, tenantId: string, messageId: string) =>
    queryOptions({
      queryKey: providerAttemptsKey(actor, tenantId, messageId),
      enabled:
        !!actor.userId &&
        roleHas(actor.role, "platform.providers") &&
        isTenantUuid(tenantId) &&
        isTenantUuid(messageId),
      queryFn: () => api.getProviderAttempts(actor, tenantId, messageId),
    }),
  historyApplicationOptions: (
    actor: SenderIdentityActor,
    page: number,
    tenantId?: string,
    allTenants = false,
  ) =>
    queryOptions({
      queryKey: [
        "historyApplicationOptions",
        historyApplicationScope(actor, tenantId, allTenants),
        page,
      ],
      enabled: !!actor.userId && (actor.role !== "super_admin" || allTenants || !!tenantId),
      queryFn: () => readHistoryApplicationOptions(api, actor, page, tenantId, allTenants),
    }),
  storedSenderBindings: (actor: SenderIdentityActor, query: SenderBindingQuery) =>
    queryOptions({
      queryKey: [
        ...senderBindingKey(actor, query.tenantId, query.providerAccountId ?? "all"),
        "list",
        query,
      ],
      enabled: !!actor.userId && actor.role === "super_admin" && isTenantUuid(query.tenantId),
      queryFn: () => api.listSenderBindings(actor, query),
    }),
  storedSenderBinding: (actor: SenderIdentityActor, tenant: string, account: string, id: string) =>
    queryOptions({
      queryKey: [...senderBindingKey(actor, tenant, account), "detail", id],
      enabled: !!actor.userId && actor.role === "super_admin" && isTenantUuid(tenant) && !!id,
      queryFn: () => api.getSenderBinding(actor, id, tenant, account),
    }),
  bindingSenderOptions: (
    actor: SenderIdentityActor,
    tenant: string,
    account: string,
    channel: RouteChannel,
    page: number,
  ) =>
    queryOptions({
      queryKey: [...senderBindingKey(actor, tenant, account), "senders", channel, page],
      enabled: !!actor.userId && actor.role === "super_admin" && isTenantUuid(tenant),
      queryFn: () =>
        api.listSenderIdentityReadPage(
          actor,
          {
            page,
            pageSize: 20,
            filters: {
              channel: channel.toLowerCase() as "sms" | "email" | "whatsapp",
              ...(channel !== "SMS"
                ? { verificationStatus: "verified" as const, operationalStatus: "active" as const }
                : {}),
            },
          },
          tenant,
        ),
    }),
  configuredProviderRoutes: (actor: SenderIdentityActor, query: ProviderRouteQuery) =>
    queryOptions({
      queryKey: [...providerRouteKey(actor), "list", query],
      enabled: !!actor.userId && actor.role === "super_admin",
      queryFn: () => api.listProviderRoutes(actor, query),
    }),
  configuredProviderRoute: (actor: SenderIdentityActor, id: string) =>
    queryOptions({
      queryKey: [...providerRouteKey(actor), "detail", id],
      enabled: !!actor.userId && actor.role === "super_admin" && !!id,
      queryFn: () => api.getProviderRoute(actor, id),
    }),
  configuredTenantRoute: (actor: SenderIdentityActor, tenant: string, channel: RouteChannel) =>
    queryOptions({
      queryKey: [...providerRouteKey(actor), "tenant", tenant, channel],
      enabled: !!actor.userId && actor.role === "super_admin" && isTenantUuid(tenant),
      queryFn: () => api.getTenantRouteAssignment(actor, tenant, channel),
    }),
  configuredSenderRoute: (actor: SenderIdentityActor, tenant: string, sender: string) =>
    queryOptions({
      queryKey: [...providerRouteKey(actor), "sender", tenant, sender],
      enabled: !!actor.userId && actor.role === "super_admin" && isTenantUuid(tenant) && !!sender,
      queryFn: () => api.getSenderRouteAssignment(actor, tenant, sender),
    }),
  routeSenderOptions: (
    actor: SenderIdentityActor,
    tenant: string,
    channel: RouteChannel,
    page: number,
  ) =>
    queryOptions({
      queryKey: [...providerRouteKey(actor), "senderOptions", tenant, channel, page],
      enabled: !!actor.userId && actor.role === "super_admin" && isTenantUuid(tenant),
      queryFn: () =>
        api.listSenderIdentityReadPage(
          actor,
          {
            page,
            pageSize: 20,
            filters: { channel: channel.toLowerCase() as "sms" | "email" | "whatsapp" },
          },
          tenant,
        ),
    }),
  providerObservedHealth: (actor: SenderIdentityActor, id: string) =>
    queryOptions({
      queryKey: [...providerMonitorKey(actor), "health", id],
      enabled: !!actor.userId && actor.role === "super_admin" && !!id,
      queryFn: () => api.getProviderObservedHealth(actor, id),
    }),
  emailEvidence: (actor: SenderIdentityActor, tenantId: string, senderId: string, page: number) =>
    queryOptions({
      queryKey: [...emailEvidenceKey(actor, tenantId, senderId), page],
      enabled:
        !!actor.userId &&
        actor.role === "super_admin" &&
        isTenantUuid(tenantId) &&
        isTenantUuid(senderId),
      queryFn: () => api.getEmailEvidence(actor, tenantId, senderId, page),
    }),
  credentialMonitor: (actor: SenderIdentityActor, query: CredentialMonitorQuery) =>
    queryOptions({
      queryKey: credentialMonitorKey(actor, query),
      enabled: !!actor.userId && actor.role === "super_admin",
      queryFn: () => api.listCredentialMonitor(actor, query),
    }),
  tenantPolicy: (actor: SenderIdentityActor, tenantId?: string) =>
    queryOptions({
      queryKey: tenantPolicyKey(actor, tenantId),
      enabled:
        !!actor.userId &&
        isTenantUuid((actor.role === "super_admin" ? tenantId : actor.tenantId) ?? ""),
      queryFn: () => api.getTenantPolicy(actor, tenantId),
    }),
  smsPilotControl: (actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: [...providerMonitorKey(actor), "smsPilotControl"],
      enabled: !!actor.userId && actor.role === "super_admin",
      queryFn: () => api.getSmsPilotControl(actor),
    }),
  smsAutomation: (actor: SenderIdentityActor, tenantId: string) =>
    queryOptions({
      queryKey: smsAutomationKey(actor, tenantId),
      enabled:
        !!actor.userId && actor.role === "super_admin" && actor.tenantId === null && !!tenantId,
      queryFn: () => api.getSmsAutomation(actor, tenantId),
      staleTime: 0,
    }),
  deliveryDispatchControl: (actor: SenderIdentityActor, channel: DeliveryChannel) =>
    queryOptions({
      queryKey: deliveryDispatchControlKey(actor, channel),
      enabled: !!actor.userId && actor.role === "super_admin" && actor.tenantId === null,
      queryFn: () => api.getDeliveryDispatchControl(actor, channel),
      staleTime: 0,
    }),
  smsDispatchControl: (actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: smsDispatchControlKey(actor),
      enabled: !!actor.userId && actor.role === "super_admin" && actor.tenantId === null,
      queryFn: () => api.getSmsDispatchControl(actor),
      staleTime: 0,
    }),
  providerMonitoring: (actor: SenderIdentityActor, query: ProviderMonitorQuery) =>
    queryOptions({
      queryKey: [...providerMonitorKey(actor), "accounts", query],
      enabled: !!actor.userId && actor.role === "super_admin",
      queryFn: () => api.listProviderMonitoring(actor, query),
    }),
  providerMetadata: (actor: SenderIdentityActor, id: string) =>
    queryOptions({
      queryKey: [...providerMonitorKey(actor), "metadata", id],
      enabled: !!actor.userId && actor.role === "super_admin" && !!id,
      queryFn: () => api.getProviderMetadata(actor, id),
    }),
  providerRecordedChecks: (actor: SenderIdentityActor, id: string, query: ProviderMonitorQuery) =>
    queryOptions({
      queryKey: [...providerMonitorKey(actor), "checks", id, query],
      enabled: !!actor.userId && actor.role === "super_admin" && !!id,
      queryFn: () => api.listProviderRecordedChecks(actor, id, query),
    }),
  webhookApplications: (
    actor: SenderIdentityActor,
    page: number,
    pageSize: number,
    tenantId?: string,
  ) =>
    queryOptions({
      queryKey: [...webhookScopeKey(actor, "", tenantId), "applications", page, pageSize],
      enabled: !!actor.userId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.listApplicationsPage(actor, { page, pageSize }, tenantId),
    }),
  webhookRegistry: (actor: SenderIdentityActor, app: string, tenantId?: string) =>
    queryOptions({
      queryKey: webhookScopeKey(actor, app, tenantId),
      enabled: !!actor.userId && !!app && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.listWebhookRegistry(actor, app, tenantId),
    }),
  webhookApplication: (actor: SenderIdentityActor, app: string, tenantId?: string) =>
    queryOptions({
      queryKey: [...webhookScopeKey(actor, app, tenantId), "application"],
      enabled: !!actor.userId && !!app && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.getApplication(actor, app, tenantId),
    }),
  webhookRegistryHistory: (
    actor: SenderIdentityActor,
    app: string,
    id: string,
    query: WebhookHistoryQuery,
    tenantId?: string,
  ) =>
    queryOptions({
      queryKey: webhookHistoryKey(actor, app, id, query, tenantId),
      enabled: !!actor.userId && !!app && !!id && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.listWebhookDeliveries(actor, app, id, query, tenantId),
    }),
  applicationSenderOptions: (
    actor: SenderIdentityActor,
    page: number,
    tenantId?: string,
    enabled = false,
  ) =>
    queryOptions({
      queryKey: [...applicationMutationKey(actor, tenantId), "senders", page],
      enabled: enabled && !!actor.userId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.listSenderIdentityReadPage(actor, { page, pageSize: 20 }, tenantId),
    }),
  credentialApplications: (actor: SenderIdentityActor, page: number, tenantId?: string) =>
    queryOptions({
      queryKey: [...credentialScopeKey(actor, "", tenantId), "applications", page],
      enabled: !!actor.userId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.listApplicationsPage(actor, { page, pageSize: 20 }, tenantId),
    }),
  credentialApplication: (actor: SenderIdentityActor, applicationId: string, tenantId?: string) =>
    queryOptions({
      queryKey: [...credentialScopeKey(actor, applicationId, tenantId), "application"],
      enabled: !!actor.userId && !!applicationId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.getApplication(actor, applicationId, tenantId),
    }),
  credentialRegistry: (
    actor: SenderIdentityActor,
    applicationId: string,
    query: CredentialRegistryQuery,
    tenantId?: string,
  ) =>
    queryOptions({
      queryKey: credentialListKey(actor, applicationId, query, tenantId),
      enabled: !!actor.userId && !!applicationId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.listCredentialRegistry(actor, applicationId, query, tenantId),
    }),
  credentialRegistryDetail: (
    actor: SenderIdentityActor,
    applicationId: string,
    id: string,
    tenantId?: string,
  ) =>
    queryOptions({
      queryKey: [...credentialScopeKey(actor, applicationId, tenantId), "detail", id],
      enabled:
        !!actor.userId && !!applicationId && !!id && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.getCredentialRegistry(actor, applicationId, id, tenantId),
    }),
  administrativeAudit: (
    actor: SenderIdentityActor,
    query: AdministrativeAuditQuery | null,
    tenantId?: string,
  ) =>
    queryOptions({
      queryKey: administrativeAuditKey(actor, query, tenantId),
      enabled: !!actor.userId && !!query,
      queryFn: () => {
        if (!query) throw new Error("Valid UTC window required");
        return api.listAdministrativeAudit(actor, query, tenantId);
      },
    }),
  administrativeAuditDetail: (actor: SenderIdentityActor, id: string, tenantId?: string) =>
    queryOptions({
      queryKey: [...administrativeAuditKey(actor, null, tenantId), "detail", id],
      enabled: !!id && !!actor.userId,
      queryFn: () => api.getAdministrativeAudit(actor, id, tenantId),
    }),
  auditRetention: (actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["auditRetention", actor.userId, actor.role, actor.tenantId],
      enabled: !!actor.userId && actor.role === "super_admin",
      queryFn: () => api.getAuditRetention(actor),
    }),
  usageReport: (actor: SenderIdentityActor, range: UsageReportRange | null, tenantId?: string) =>
    queryOptions({
      queryKey: usageReportKey(actor, range, tenantId),
      enabled: !!range && !!actor.userId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => {
        if (!range) throw new Error("Valid UTC range required");
        return api.getUsageReport(actor, range, tenantId);
      },
    }),
  contentTemplates: (actor: SenderIdentityActor, query: ContentTemplateQuery, tenantId?: string) =>
    queryOptions({
      queryKey: contentTemplateKey(actor, tenantId, query),
      enabled: !!actor.userId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.listContentTemplates(actor, query, tenantId),
    }),
  contentTemplate: (actor: SenderIdentityActor, id: string, tenantId?: string) =>
    queryOptions({
      queryKey: contentTemplateKey(actor, tenantId, undefined, id),
      enabled: !!id && !!actor.userId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.getContentTemplate(actor, id, tenantId),
    }),
  templateRegistry: (actor: SenderIdentityActor, query: RegistryQuery, tenantId?: string) =>
    queryOptions({
      queryKey: registryListKey(actor, query, tenantId),
      enabled: !!actor.userId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.listTemplateRegistry(actor, query, tenantId),
    }),
  templateRegistryDetail: (actor: SenderIdentityActor, id: string, tenantId?: string) =>
    queryOptions({
      queryKey: registryDetailKey(actor, id, tenantId),
      enabled: !!id && !!actor.userId && (actor.role !== "super_admin" || !!tenantId),
      queryFn: () => api.getTemplateRegistry(actor, id, tenantId),
    }),
  bulkHistoryList: (
    actor: SenderIdentityActor,
    query: BulkHistoryQuery | null,
    allTenants: boolean,
    tenantId?: string,
  ) =>
    queryOptions({
      queryKey: bulkHistoryListKey(actor, query, allTenants ? "all-tenants" : "tenant", tenantId),
      enabled: !!query,
      queryFn: () => {
        if (!query) throw new Error("Valid range required");
        return allTenants
          ? api.listAllTenantBulkJobHistory(actor, query)
          : api.listBulkJobHistory(actor, query, tenantId);
      },
    }),
  bulkHistoryDetail: (actor: SenderIdentityActor, id: string, tenantId?: string) =>
    queryOptions({
      queryKey: bulkHistoryDetailKey(actor, id, tenantId),
      enabled: !!id,
      queryFn: () => api.getBulkJobHistory(actor, id, tenantId),
    }),
  bulkHistoryItems: (
    actor: SenderIdentityActor,
    id: string,
    query: BulkHistoryItemsQuery,
    tenantId?: string,
  ) =>
    queryOptions({
      queryKey: bulkHistoryItemsKey(actor, id, query, tenantId),
      enabled: !!id,
      queryFn: () => api.listBulkJobHistoryItems(actor, id, query, tenantId),
    }),
  dashboard: () => queryOptions({ queryKey: ["dashboard"], queryFn: () => api.getDashboard() }),
  dashboardMessages: () =>
    queryOptions({
      queryKey: ["dashboard", "messages"],
      queryFn: () => api.getDashboardMessages(),
    }),
  dashboardQuota: () =>
    queryOptions({ queryKey: ["dashboard", "quota"], queryFn: () => api.getDashboardQuota() }),
  usageQuota: (actor: SenderIdentityActor, tenantId?: string | null) =>
    queryOptions({
      queryKey: ["usage", "quota", actor.userId, actor.role, actor.tenantId, tenantId],
      queryFn: () => api.getDashboardQuota(actor.role === "super_admin" ? tenantId ?? undefined : undefined),
      enabled: Boolean(actor.userId) && (actor.role !== "super_admin" || Boolean(tenantId)),
    }),
  messages: (p: ListParams, actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["messages", actor.role, actor.tenantId, p],
      queryFn: () => api.listMessages(p, actor),
      placeholderData: keepPreviousData,
    }),
  messageHistory: (
    query: MessageHistoryQuery | null,
    actor: SenderIdentityActor,
    tenantId?: string,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: tenantMessageHistoryQueryKey(query, actor, tenantId),
      queryFn: () => {
        if (!query) throw new Error("A valid message history date range is required.");
        return api.listMessageHistory(query, actor, tenantId);
      },
      enabled: enabled && query !== null,
    }),
  allTenantMessageHistory: (
    query: MessageHistoryQuery | null,
    actor: SenderIdentityActor,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: allTenantMessageHistoryQueryKey(query, actor),
      queryFn: () => {
        if (!query) throw new Error("A valid message history date range is required.");
        return api.listAllTenantMessageHistory(query, actor);
      },
      enabled: enabled && actor.role === "super_admin" && query !== null,
    }),
  messageHistoryDetail: (
    id: string,
    actor: SenderIdentityActor,
    tenantId?: string,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: messageHistoryDetailQueryKey(id, actor, tenantId),
      queryFn: () => api.getMessageHistory(id, actor, tenantId),
      enabled: enabled && !!id,
    }),
  message: (id: string, actor: SenderIdentityActor, tenantId?: string) =>
    queryOptions({
      queryKey: ["message", actor.role, actor.tenantId, tenantId, id],
      queryFn: () => api.getMessage(id, actor, tenantId),
    }),
  templates: (p: TemplateListQuery, actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["templates", actor.role, actor.tenantId, p],
      queryFn: () => api.listTemplates(p, actor),
      placeholderData: keepPreviousData,
    }),
  applications: (actor: SenderIdentityActor, tenantId?: string) =>
    queryOptions({
      queryKey: ["applications", actor.role, actor.tenantId, tenantId],
      queryFn: () => api.listApplications(actor, tenantId),
    }),
  applicationsPage: (
    actor: SenderIdentityActor,
    query: ApplicationListQuery,
    tenantId?: string,
    enabled = true,
    isLive = false,
  ) =>
    queryOptions(
      applicationReadQueryOptions(
        applicationPageQueryKey(actor, query, tenantId),
        () =>
          api.listApplicationsPage(
            actor,
            query,
            actor.role === "super_admin" ? tenantId : undefined,
          ),
        enabled && (!isLive || actor.role !== "super_admin" || !!tenantId),
      ),
    ),
  allTenantApplicationsPage: (
    actor: SenderIdentityActor,
    query: ApplicationListQuery,
    enabled = true,
  ) =>
    queryOptions(
      applicationReadQueryOptions(
        allTenantApplicationPageQueryKey(actor, query),
        () => {
          if (actor.role !== "super_admin") {
            throw new Error("Platform applications require a platform administrator.");
          }
          return api.listAllTenantApplications(actor, query);
        },
        enabled && actor.role === "super_admin",
      ),
    ),
  application: (actor: SenderIdentityActor, id: string, tenantId?: string, enabled = true) =>
    queryOptions(
      applicationReadQueryOptions(
        applicationDetailQueryKey(actor, id, tenantId),
        () => api.getApplication(actor, id, actor.role === "super_admin" ? tenantId : undefined),
        enabled && !!id && (actor.role !== "super_admin" || !!tenantId),
      ),
    ),
  credentials: (actor: SenderIdentityActor, query: ApiCredentialListQuery) =>
    queryOptions({
      queryKey: ["credentials", actor.role, actor.tenantId, query],
      queryFn: () => api.listCredentials(actor, query),
      placeholderData: keepPreviousData,
    }),
  audit: (p: ListParams, actor: SenderIdentityActor) =>
    queryOptions({
      queryKey: ["audit", actor.role, actor.tenantId, p],
      queryFn: () => api.listAuditEvents(p, actor),
      placeholderData: keepPreviousData,
    }),
  usage: (actor: SenderIdentityActor, tenantId?: string, tableQuery?: TenantUsageTableQuery) =>
    queryOptions({
      queryKey: ["usage", actor.role, actor.tenantId, tenantId, tableQuery],
      queryFn: () => api.getUsage(actor, tenantId, tableQuery),
    }),
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
  providerUsageBilling: (actor: SenderIdentityActor, providerId?: string) =>
    queryOptions({
      queryKey: ["providerUsageBilling", actor.role, providerId],
      queryFn: () =>
        providerId ? api.getProviderUsageBilling(actor, providerId) : Promise.resolve(null),
      enabled: actor.role === "super_admin" && !!providerId,
    }),
  senderIdentities: (actor: SenderIdentityActor, query: SenderIdentityListQuery) =>
    queryOptions({
      queryKey: ["senderIdentities", actor.role, actor.tenantId, query],
      queryFn: () => api.listSenderIdentities(actor, query),
      placeholderData: keepPreviousData,
    }),
  senderIdentityReadPage: (
    actor: SenderIdentityActor,
    query: SenderIdentityListQuery,
    tenantId?: string,
    enabled = true,
  ) =>
    queryOptions({
      queryKey: senderIdentityPageQueryKey(actor, query, tenantId),
      queryFn: () => api.listSenderIdentityReadPage(actor, query, tenantId),
      enabled: enabled && senderIdentityScopeIsAvailable(actor.role, tenantId),
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
          throw new Error("Platform sender identities require a platform administrator.");
        }
        return api.listAllTenantSenderIdentityReadPage(actor, query);
      },
      enabled: enabled && actor.role === "super_admin",
    }),
  senderIdentityRead: (actor: SenderIdentityActor, id: string, tenantId?: string, enabled = true) =>
    queryOptions({
      queryKey: senderIdentityDetailQueryKey(actor, id, tenantId),
      queryFn: () => api.getSenderIdentityRead(actor, id, tenantId),
      enabled: enabled && !!id && senderIdentityScopeIsAvailable(actor.role, tenantId),
    }),
  sendableSenderIdentities: (actor: SenderIdentityActor, applicationId: string, channel: Channel) =>
    queryOptions({
      queryKey: ["sendableSenderIdentities", actor.role, actor.tenantId, applicationId, channel],
      enabled: !!applicationId,
      queryFn: () => api.listSendableSenderIdentities(actor, applicationId, channel),
    }),
  bulkJobs: (actor: SenderIdentityActor, query: BulkJobListQuery) =>
    queryOptions({
      queryKey: ["bulkJobs", actor.role, actor.tenantId, query],
      queryFn: () => api.listBulkJobs(actor, query),
      placeholderData: keepPreviousData,
    }),
  bulkJob: (actor: SenderIdentityActor, id: string, tenantId?: string) =>
    queryOptions({
      queryKey: ["bulkJob", actor.role, actor.tenantId, tenantId, id],
      enabled: !!id,
      queryFn: () => api.getBulkJob(actor, id, tenantId),
    }),
  bulkTemplates: (actor: SenderIdentityActor, applicationId: string, channel: Channel) =>
    queryOptions({
      queryKey: ["bulkTemplates", actor.role, actor.tenantId, applicationId, channel],
      enabled: !!applicationId,
      queryFn: () => api.listBulkTemplates(actor, applicationId, channel),
    }),
  webhooks: () => queryOptions({ queryKey: ["webhooks"], queryFn: () => api.listWebhooks() }),
  users: (actor: SenderIdentityActor, query: UserListQuery, targetTenantId?: string) =>
    queryOptions({
      queryKey: ["users", actor.role, actor.tenantId, targetTenantId, query],
      queryFn: () => api.listUsers(actor, query, targetTenantId),
      placeholderData: keepPreviousData,
    }),
  settings: () => queryOptions({ queryKey: ["settings"], queryFn: () => api.getSettings() }),
  report: (actor: SenderIdentityActor, tenantId?: string) =>
    queryOptions({
      queryKey: ["report", actor.role, actor.tenantId, tenantId],
      queryFn: () => api.getReport(actor, tenantId),
    }),
  plans: (query: PlanListQuery = {}) =>
    queryOptions({
      queryKey: ["plans", query],
      queryFn: () => api.listPlans(query),
      placeholderData: keepPreviousData,
    }),
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

export const registryMutations = {
  register: (actor: SenderIdentityActor, input: RegisterTemplateInput, tenantId?: string) =>
    api.registerTemplate(actor, input, tenantId),
  lifecycle: (
    actor: SenderIdentityActor,
    id: string,
    action: "ready" | "retire",
    tenantId?: string,
  ) => api.changeTemplateRegistry(actor, id, action, tenantId),
  evidence: (
    actor: SenderIdentityActor,
    id: string,
    input: TemplateEvidenceInput,
    tenantId?: string,
  ) => api.recordTemplateEvidence(actor, id, input, tenantId),
};

export const auditMutations = {
  updateRetention: (actor: SenderIdentityActor, days: number) =>
    api.updateAuditRetention(actor, days),
};

export const credentialRegistryMutations = {
  issue: (
    actor: SenderIdentityActor,
    applicationId: string,
    input: CredentialIssueInput,
    tenantId?: string,
  ) => api.issueRegistryCredential(actor, applicationId, input, tenantId),
  rotate: (
    actor: SenderIdentityActor,
    applicationId: string,
    id: string,
    input: CredentialIssueInput,
    tenantId?: string,
  ) => api.rotateRegistryCredential(actor, applicationId, id, input, tenantId),
  revoke: (
    actor: SenderIdentityActor,
    applicationId: string,
    id: string,
    reason: string,
    tenantId?: string,
  ) => api.revokeRegistryCredential(actor, applicationId, id, reason, tenantId),
};

export const liveApplicationMutations = {
  apply: (
    actor: SenderIdentityActor,
    operation: import("./application-mutations").LiveApplicationMutation,
    tenantId?: string,
  ) => api.applyLiveApplicationMutation(actor, operation, tenantId),
};

export const webhookRegistryMutations = {
  apply: (
    actor: SenderIdentityActor,
    app: string,
    operation: WebhookRegistryOperation,
    tenantId?: string,
  ) => api.applyWebhookRegistryMutation(actor, app, operation, tenantId),
};

export const liveSenderMutations = {
  apply: (
    actor: SenderIdentityActor,
    operation: import("./sender-mutations").LiveSenderMutation,
    tenantId?: string,
  ) => api.applyLiveSenderMutation(actor, operation, tenantId),
};

export const monitoringExports = {
  download: (
    actor: SenderIdentityActor,
    request: import("./monitoring-export").MonitoringExport,
    tenantId?: string,
  ) => api.downloadMonitoringCsv(actor, request, tenantId),
};

export const providerAccountMutations = {
  apply: (
    actor: SenderIdentityActor,
    operation: import("./provider-account-mutations").ProviderAccountMutation,
  ) => api.applyProviderAccountMutation(actor, operation),
};

export const providerRouteMutations = {
  apply: (
    actor: SenderIdentityActor,
    operation: import("./provider-routes").ProviderRouteOperation,
  ) => api.applyProviderRouteMutation(actor, operation),
};

export const senderBindingMutations = {
  apply: (
    actor: SenderIdentityActor,
    operation: import("./sender-bindings").SenderBindingOperation,
  ) => api.applySenderBindingMutation(actor, operation),
};
export const emailEvidenceMutations = {
  record: (
    actor: SenderIdentityActor,
    tenantId: string,
    senderId: string,
    input: import("./email-evidence").EmailEvidenceInput,
  ) => api.recordEmailEvidence(actor, tenantId, senderId, input),
};

export const unknownResolutionMutations = {
  resolve: (
    actor: SenderIdentityActor,
    tenantId: string,
    messageId: string,
    input: import("./unknown-resolution").UnknownResolutionInput,
  ) => api.resolveUnknownMessage(actor, tenantId, messageId, input),
};

export const humanMessageMutations = {
  submit: (
    actor: SenderIdentityActor,
    app: string,
    input: import("./human-message").HumanMessageInput,
    key: string,
    tenantId?: string,
  ) => api.submitHumanMessage(actor, app, input, key, tenantId),
};
export const mockMessageMutations = {
  send: (...args: Parameters<typeof api.sendMessage>) => api.sendMessage(...args),
};
export const bulkCancellationMutations = {
  cancel: (
    actor: SenderIdentityActor,
    target: import("./bulk-cancellation").BulkCancellationTarget,
  ) => api.cancelHumanBulkJob(actor, target),
};
export const humanBulkMutations = {
  create: (...args: Parameters<typeof api.createHumanBulkJob>) => api.createHumanBulkJob(...args),
};
export const notificationMutations = {
  markRead: (id: string) => api.markNotificationRead(id),
  markAllRead: () => api.markAllNotificationsRead(),
};
export const contentTemplateMutations = {
  apply: (...args: Parameters<typeof api.applyContentTemplateMutation>) =>
    api.applyContentTemplateMutation(...args),
  render: (...args: Parameters<typeof api.renderContentTemplate>) =>
    api.renderContentTemplate(...args),
};

export const smsAutomationMutations = {
  update: (actor: SenderIdentityActor, tenantId: string, input: SmsAutomationInput) =>
    api.updateSmsAutomation(actor, tenantId, input),
};
export const smsDispatchMutations = {
  update: (actor: SenderIdentityActor, enabled: boolean, revision: number, confirmed: boolean) =>
    api.updateSmsDispatchControl(actor, enabled, revision, confirmed),
};

export const deliveryDispatchMutations = {
  update: (
    actor: SenderIdentityActor,
    channel: DeliveryChannel,
    enabled: boolean,
    revision: number,
    confirmed: boolean,
  ) => api.updateDeliveryDispatchControl(actor, channel, enabled, revision, confirmed),
};
