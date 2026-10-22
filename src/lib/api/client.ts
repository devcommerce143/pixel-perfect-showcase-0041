import type {
  CredentialMetadata,
  CredentialIssueInput,
  CredentialRegistryQuery,
  CredentialRegistryPage,
  IssuedRegistryCredential,
} from "./credential-registry.ts";
import type {
  AdministrativeAuditQuery,
  AdministrativeAuditPage,
  AdministrativeAuditEvent,
  AuditRetentionPolicy,
} from "./administrative-audit.ts";
import type { LiveUsageReport, UsageReportRange } from "./usage-report.ts";
import type {
  RegistryQuery,
  RegistryPage,
  RegistryTemplate,
  RegisterTemplateInput,
  TemplateEvidenceInput,
} from "./template-registry.ts";
import type {
  BulkHistoryQuery,
  BulkHistoryJob,
  BulkHistoryItem,
  BulkHistoryItemsQuery,
  BulkHistoryPage,
} from "./bulk-job-history-types.ts";
import type {
  BulkJob,
  BulkJobListQuery,
  BulkSuppressionCandidate,
  Channel,
  ChannelConfig,
  ConfigParam,
  CreateBulkJobInput,
  Plan,
  PlanListQuery,
  PlatformApiClient,
  PlatformApiClientListQuery,
  PortalUser,
  ReportSummary,
  RoutingRule,
  TenantSettings,
  Webhook,
  WebhookDelivery,
  ApiCredential,
  ApiCredentialListQuery,
  Application,
  ApplicationListQuery,
  AuditEvent,
  DashboardQuotaWarning,
  DashboardRecentMessages,
  DashboardSummary,
  ListParams,
  SenderIdentityListQuery,
  TenantListQuery,
  TenantSubscriptionChannelOverrideInput,
  TenantSubscriptionHistoryPage,
  TenantSubscriptionHistoryQuery,
  TenantSubscriptionOverridesInput,
  TenantCatalogItem,
  TenantCreateResponse,
  TenantDetail,
  TenantDirectoryItem,
  TenantPlanAssignmentInput,
  TenantPlanAssignmentResult,
  TenantSubscriptionView,
  TenantProfileUpdateInput,
  TenantUpsertInput,
  TemplateListQuery,
  UserListQuery,
  CreatePortalUserInput,
  UpdatePortalUserProfileInput,
  TenantUserRole,
  UserStatus,
  Message,
  MessageHistoryDetail,
  MessageHistoryItem,
  MessageHistoryQuery,
  PlatformMessageHistoryItem,
  PlatformApplication,
  Paginated,
  Provider,
  ProviderConfigInput,
  ProviderUsageBilling,
  ProviderTestResult,
  SenderIdentity,
  SenderIdentityActor,
  SenderIdentityRead,
  PlatformSenderIdentityRead,
  SenderIdentityFilters,
  SenderIdentityInput,
  SenderIdentityVerificationStatus,
  SendMessageInput,
  Template,
  Tenant,
  TenantUsageTableQuery,
  UsageSummary,
} from "./types";
import { getCachedAccessToken } from "../auth/oidc";
import { readClientEnv } from "../config/read-env";
import { resolvePortalConfig, selectPortalApi } from "../config/runtime";
import { createLiveApi } from "./http/live-api";
import { createMockApi } from "./mock/mock-api";

/**
 * Contract for the Dolf Connect API as consumed by the web portal.
 * Tenant callers are scoped by the backend from their token. Platform callers
 * use named-tenant routes or dedicated platform-wide list routes, with
 * authorization still enforced by the backend.
 * Replace the mock implementation with an HTTP implementation (via the API gateway)
 * without changing any screen.
 */
export interface DolfConnectApi {
  listSenderBindings(
    actor: SenderIdentityActor,
    query: import("./sender-bindings.ts").SenderBindingQuery,
  ): Promise<import("./sender-bindings.ts").SenderBindingPage>;
  getSenderBinding(
    actor: SenderIdentityActor,
    id: string,
    tenantId: string,
    providerAccountId: string,
  ): Promise<import("./sender-bindings.ts").StoredSenderBinding>;
  applySenderBindingMutation(
    actor: SenderIdentityActor,
    operation: import("./sender-bindings.ts").SenderBindingOperation,
  ): Promise<import("./sender-bindings.ts").SenderBindingMutationResult>;
  listProviderRoutes(
    actor: SenderIdentityActor,
    query: import("./provider-routes.ts").ProviderRouteQuery,
  ): Promise<import("./provider-routes.ts").ProviderRoutePage>;
  getProviderRoute(
    actor: SenderIdentityActor,
    id: string,
  ): Promise<import("./provider-routes.ts").ConfiguredProviderRoute>;
  getTenantRouteAssignment(
    actor: SenderIdentityActor,
    tenantId: string,
    channel: import("./provider-routes.ts").RouteChannel,
  ): Promise<import("./provider-routes.ts").TenantRouteAssignment | null>;
  getSenderRouteAssignment(
    actor: SenderIdentityActor,
    tenantId: string,
    senderId: string,
  ): Promise<import("./provider-routes.ts").SenderRouteAssignment | null>;
  applyProviderRouteMutation(
    actor: SenderIdentityActor,
    operation: import("./provider-routes.ts").ProviderRouteOperation,
  ): Promise<import("./provider-routes.ts").ProviderRouteMutationResult>;
  applyProviderAccountMutation(
    actor: SenderIdentityActor,
    operation: import("./provider-account-mutations.ts").ProviderAccountMutation,
  ): Promise<import("./provider-account-mutations.ts").ProviderAccountMutationResult>;
  getEmailEvidence(
    actor: SenderIdentityActor,
    tenantId: string,
    senderId: string,
    page: number,
  ): Promise<import("./email-evidence.ts").EmailEvidencePage>;
  recordEmailEvidence(
    actor: SenderIdentityActor,
    tenantId: string,
    senderId: string,
    input: import("./email-evidence.ts").EmailEvidenceInput,
  ): Promise<import("./email-evidence.ts").EmailEvidenceCurrent>;
  resolveUnknownMessage(
    actor: SenderIdentityActor,
    tenantId: string,
    messageId: string,
    input: import("./unknown-resolution.ts").UnknownResolutionInput,
  ): Promise<import("./unknown-resolution.ts").UnknownResolutionResult>;
  getProviderAttempts(
    actor: SenderIdentityActor,
    tenantId: string,
    messageId: string,
  ): Promise<import("./provider-attempts.ts").RecordedProviderAttempts>;
  submitHumanMessage(
    actor: SenderIdentityActor,
    applicationId: string,
    input: import("./human-message.ts").HumanMessageInput,
    idempotencyKey: string,
    tenantId?: string,
  ): Promise<import("./human-message.ts").HumanMessageAcceptance>;
  listCredentialMonitor(
    actor: SenderIdentityActor,
    query: import("./credential-monitor.ts").CredentialMonitorQuery,
  ): Promise<Paginated<import("./credential-monitor.ts").MonitoredCredential>>;
  getTenantPolicy(actor: SenderIdentityActor, tenantId?: string): Promise<TenantSubscriptionView>;
  getSmsPilotControl(
    actor: SenderIdentityActor,
  ): Promise<import("./provider-monitoring.ts").SmsPilotControlState>;
  getProviderObservedHealth(
    actor: SenderIdentityActor,
    id: string,
  ): Promise<import("./provider-monitoring.ts").ProviderHealthRecord>;
  listProviderMonitoring(
    actor: SenderIdentityActor,
    query: import("./provider-monitoring.ts").ProviderMonitorQuery,
  ): Promise<
    import("./provider-monitoring.ts").ProviderCursorPage<
      import("./provider-monitoring.ts").ProviderHealthRecord
    >
  >;
  getProviderMetadata(
    actor: SenderIdentityActor,
    id: string,
  ): Promise<import("./provider-monitoring.ts").ProviderAccountMetadata>;
  listProviderRecordedChecks(
    actor: SenderIdentityActor,
    id: string,
    query: import("./provider-monitoring.ts").ProviderMonitorQuery,
  ): Promise<
    import("./provider-monitoring.ts").ProviderCursorPage<
      import("./provider-monitoring.ts").ProviderRecordedCheck
    >
  >;
  downloadMonitoringCsv(
    actor: SenderIdentityActor,
    request: import("./monitoring-export.ts").MonitoringExport,
    tenantId?: string,
  ): Promise<string>;
  applyLiveSenderMutation(
    actor: SenderIdentityActor,
    operation: import("./sender-mutations.ts").LiveSenderMutation,
    tenantId?: string,
  ): Promise<SenderIdentityRead>;
  listWebhookRegistry(
    actor: SenderIdentityActor,
    applicationId: string,
    tenantId?: string,
  ): Promise<import("./webhook-registry.ts").RegisteredWebhook[]>;
  getWebhookRegistry(
    actor: SenderIdentityActor,
    applicationId: string,
    id: string,
    tenantId?: string,
  ): Promise<import("./webhook-registry.ts").RegisteredWebhook>;
  listWebhookDeliveries(
    actor: SenderIdentityActor,
    applicationId: string,
    id: string,
    query: import("./webhook-registry.ts").WebhookHistoryQuery,
    tenantId?: string,
  ): Promise<import("./webhook-registry.ts").WebhookHistoryPage>;
  applyWebhookRegistryMutation(
    actor: SenderIdentityActor,
    applicationId: string,
    operation: import("./webhook-registry.ts").WebhookRegistryOperation,
    tenantId?: string,
  ): Promise<import("./webhook-registry.ts").WebhookRegistryMutationResult>;
  applyLiveApplicationMutation(
    actor: SenderIdentityActor,
    operation: import("./application-mutations.ts").LiveApplicationMutation,
    tenantId?: string,
  ): Promise<Application>;
  listCredentialRegistry(
    actor: SenderIdentityActor,
    applicationId: string,
    query: CredentialRegistryQuery,
    tenantId?: string,
  ): Promise<CredentialRegistryPage>;
  getCredentialRegistry(
    actor: SenderIdentityActor,
    applicationId: string,
    id: string,
    tenantId?: string,
  ): Promise<CredentialMetadata>;
  issueRegistryCredential(
    actor: SenderIdentityActor,
    applicationId: string,
    input: CredentialIssueInput,
    tenantId?: string,
  ): Promise<IssuedRegistryCredential>;
  rotateRegistryCredential(
    actor: SenderIdentityActor,
    applicationId: string,
    id: string,
    input: CredentialIssueInput,
    tenantId?: string,
  ): Promise<IssuedRegistryCredential>;
  revokeRegistryCredential(
    actor: SenderIdentityActor,
    applicationId: string,
    id: string,
    reason: string,
    tenantId?: string,
  ): Promise<CredentialMetadata>;
  listAdministrativeAudit(
    actor: SenderIdentityActor,
    query: AdministrativeAuditQuery,
    tenantId?: string,
  ): Promise<AdministrativeAuditPage>;
  getAdministrativeAudit(
    actor: SenderIdentityActor,
    id: string,
    tenantId?: string,
  ): Promise<AdministrativeAuditEvent>;
  getAuditRetention(actor: SenderIdentityActor): Promise<AuditRetentionPolicy>;
  updateAuditRetention(actor: SenderIdentityActor, days: number): Promise<AuditRetentionPolicy>;
  getUsageReport(
    actor: SenderIdentityActor,
    range: UsageReportRange,
    tenantId?: string,
  ): Promise<LiveUsageReport>;
  listTemplateRegistry(
    actor: SenderIdentityActor,
    query: RegistryQuery,
    tenantId?: string,
  ): Promise<RegistryPage>;
  getTemplateRegistry(
    actor: SenderIdentityActor,
    id: string,
    tenantId?: string,
  ): Promise<RegistryTemplate>;
  registerTemplate(
    actor: SenderIdentityActor,
    input: RegisterTemplateInput,
    tenantId?: string,
  ): Promise<RegistryTemplate>;
  changeTemplateRegistry(
    actor: SenderIdentityActor,
    id: string,
    action: "ready" | "retire",
    tenantId?: string,
  ): Promise<RegistryTemplate>;
  recordTemplateEvidence(
    actor: SenderIdentityActor,
    id: string,
    input: TemplateEvidenceInput,
    tenantId?: string,
  ): Promise<RegistryTemplate>;
  getDashboard(): Promise<DashboardSummary>;
  /** Live mode reads `GET /api/v1/dashboard/messages`. Mock screens keep using `listMessages`. */
  getDashboardMessages(): Promise<DashboardRecentMessages>;
  /** Live mode reads `GET /api/v1/dashboard/quota`. Mock screens keep using `getUsage`. */
  getDashboardQuota(): Promise<DashboardQuotaWarning>;
  listMessages(params: ListParams, actor: SenderIdentityActor): Promise<Paginated<Message>>;
  getMessage(id: string, actor: SenderIdentityActor, tenantId?: string): Promise<Message | null>;
  listMessageHistory(
    params: MessageHistoryQuery,
    actor: SenderIdentityActor,
    tenantId?: string,
  ): Promise<Paginated<MessageHistoryItem>>;
  listAllTenantMessageHistory(
    params: MessageHistoryQuery,
    actor: SenderIdentityActor,
  ): Promise<Paginated<PlatformMessageHistoryItem>>;
  getMessageHistory(
    id: string,
    actor: SenderIdentityActor,
    tenantId?: string,
  ): Promise<MessageHistoryDetail | null>;
  /** The actor is mock-only; an HTTP implementation must derive tenant/role claims from the authenticated token. */
  sendMessage(
    input: SendMessageInput,
    actor: SenderIdentityActor,
  ): Promise<{ id: string; status: "accepted" }>;
  listTemplates(
    params: TemplateListQuery,
    actor: SenderIdentityActor,
  ): Promise<Paginated<Template>>;
  createTemplate(
    actor: SenderIdentityActor,
    input: Pick<Template, "name" | "channel" | "category" | "language" | "subject" | "body">,
  ): Promise<Template>;
  updateTemplate(
    actor: SenderIdentityActor,
    id: string,
    input: Pick<Template, "name" | "channel" | "category" | "language" | "subject" | "body">,
  ): Promise<Template>;
  submitTemplateForApproval(actor: SenderIdentityActor, id: string): Promise<Template>;
  activateTemplate(actor: SenderIdentityActor, id: string): Promise<Template>;
  deactivateTemplate(actor: SenderIdentityActor, id: string): Promise<Template>;
  listApplications(actor: SenderIdentityActor, tenantId?: string): Promise<Application[]>;
  listApplicationsPage(
    actor: SenderIdentityActor,
    query: ApplicationListQuery,
    tenantId?: string,
  ): Promise<Paginated<Application>>;
  listAllTenantApplications(
    actor: SenderIdentityActor,
    query: ApplicationListQuery,
  ): Promise<Paginated<PlatformApplication>>;
  getApplication(
    actor: SenderIdentityActor,
    id: string,
    tenantId?: string,
  ): Promise<Application | null>;
  createApplication(
    actor: SenderIdentityActor,
    input: Pick<Application, "tenantId" | "name" | "environment" | "channels" | "scopes">,
  ): Promise<Application>;
  updateApplication(
    actor: SenderIdentityActor,
    id: string,
    input: Pick<Application, "name" | "environment" | "channels" | "scopes">,
  ): Promise<Application>;
  setApplicationStatus(
    actor: SenderIdentityActor,
    id: string,
    status: Application["status"],
  ): Promise<void>;
  listCredentials(
    actor: SenderIdentityActor,
    query: ApiCredentialListQuery,
  ): Promise<Paginated<ApiCredential>>;
  createCredential(
    actor: SenderIdentityActor,
    input: {
      applicationId: string;
      scopes: string[];
      environment?: Application["environment"];
      expiresAt?: string | null;
      rateLimit?: number | null;
    },
  ): Promise<{ credential: ApiCredential; secret: string }>;
  rotateCredential(
    actor: SenderIdentityActor,
    id: string,
  ): Promise<{ credential: ApiCredential; secret: string }>;
  revokeCredential(actor: SenderIdentityActor, id: string, reason?: string): Promise<void>;
  listAuditEvents(params: ListParams, actor: SenderIdentityActor): Promise<Paginated<AuditEvent>>;
  getUsage(
    actor: SenderIdentityActor,
    tenantId?: string,
    tableQuery?: TenantUsageTableQuery,
  ): Promise<UsageSummary>;
  /** Platform scope (super admin only). */
  listTenants(params: TenantListQuery): Promise<Paginated<TenantCatalogItem>>;
  getTenant(tenantId: string): Promise<TenantDetail>;
  getTenantSubscription(tenantId: string): Promise<TenantSubscriptionView>;
  getTenantSubscriptionHistory(
    tenantId: string,
    query: TenantSubscriptionHistoryQuery,
  ): Promise<TenantSubscriptionHistoryPage>;
  assignTenantPlan(
    tenantId: string,
    input: TenantPlanAssignmentInput,
  ): Promise<TenantPlanAssignmentResult>;
  updateTenantSubscriptionOverrides(
    tenantId: string,
    input: TenantSubscriptionOverridesInput,
  ): Promise<TenantSubscriptionView>;
  setTenantSubscriptionChannelOverride(
    tenantId: string,
    channel: Channel,
    input: TenantSubscriptionChannelOverrideInput,
  ): Promise<TenantSubscriptionView>;
  clearTenantSubscriptionChannelOverride(
    tenantId: string,
    channel: Channel,
  ): Promise<TenantSubscriptionView>;
  cancelTenantSubscription(tenantId: string): Promise<TenantSubscriptionView>;
  createTenant(input: TenantUpsertInput): Promise<TenantDirectoryItem | TenantCreateResponse>;
  updateTenantProfile(id: string, input: TenantProfileUpdateInput): Promise<TenantDetail>;
  updateTenant(id: string, input: TenantUpsertInput): Promise<TenantDirectoryItem>;
  setTenantStatus(id: string, status: Tenant["status"]): Promise<void>;
  listProviders(): Promise<Provider[]>;
  getProviderUsageBilling(
    actor: SenderIdentityActor,
    providerId: string,
  ): Promise<ProviderUsageBilling | null>;
  createProvider(input: ProviderConfigInput): Promise<Provider>;
  updateProvider(id: string, input: ProviderConfigInput): Promise<Provider>;
  setProviderEnabled(id: string, enabled: boolean): Promise<void>;
  testProviderConnection(id: string): Promise<ProviderTestResult>;
  listBulkJobHistory(
    actor: SenderIdentityActor,
    query: BulkHistoryQuery,
    tenantId?: string,
  ): Promise<BulkHistoryPage<BulkHistoryJob>>;
  cancelHumanBulkJob(
    actor: SenderIdentityActor,
    target: import("./bulk-cancellation.ts").BulkCancellationTarget,
  ): Promise<import("./bulk-cancellation.ts").BulkCancellationReceipt>;
  createHumanBulkJob(
    actor: SenderIdentityActor,
    applicationId: string,
    input:
      import("./human-message.ts").HumanMessageInput | import("./human-bulk.ts").HumanBulkCsvInput,
    key: string,
    tenantId?: string,
  ): Promise<import("./human-bulk.ts").HumanBulkReceipt>;
  listContentTemplates(
    actor: SenderIdentityActor,
    query: import("./content-template.ts").ContentTemplateQuery,
    tenantId?: string,
  ): Promise<import("./content-template.ts").ContentTemplatePage>;
  getContentTemplate(
    actor: SenderIdentityActor,
    id: string,
    tenantId?: string,
  ): Promise<import("./content-template.ts").ContentTemplateDetail>;
  applyContentTemplateMutation(
    actor: SenderIdentityActor,
    operation: import("./content-template.ts").ContentTemplateOperation,
    tenantId?: string,
  ): Promise<import("./content-template.ts").ContentTemplateDetail>;
  renderContentTemplate(
    actor: SenderIdentityActor,
    id: string,
    parameters: Record<string, string>,
    tenantId?: string,
  ): Promise<import("./content-template.ts").RenderedContentTemplate>;
  listAllTenantBulkJobHistory(
    actor: SenderIdentityActor,
    query: BulkHistoryQuery,
  ): Promise<BulkHistoryPage<BulkHistoryJob>>;
  getBulkJobHistory(
    actor: SenderIdentityActor,
    id: string,
    tenantId?: string,
  ): Promise<BulkHistoryJob>;
  listBulkJobHistoryItems(
    actor: SenderIdentityActor,
    id: string,
    query: BulkHistoryItemsQuery,
    tenantId?: string,
  ): Promise<BulkHistoryPage<BulkHistoryItem>>;
  listBulkJobs(actor: SenderIdentityActor, query: BulkJobListQuery): Promise<Paginated<BulkJob>>;
  getBulkJob(actor: SenderIdentityActor, id: string, tenantId?: string): Promise<BulkJob | null>;
  listBulkTemplates(actor: SenderIdentityActor, applicationId: string, channel: SendMessageInput["channel"]): Promise<Template[]>;
  checkBulkSuppression(actor: SenderIdentityActor, applicationId: string, candidates: BulkSuppressionCandidate[]): Promise<number[]>;
  createBulkJob(actor: SenderIdentityActor, input: CreateBulkJobInput): Promise<BulkJob>;
  listWebhooks(): Promise<Webhook[]>;
  createWebhook(input: Pick<Webhook, "url" | "events" | "applicationName">): Promise<{ webhook: Webhook; signingSecret: string }>;
  updateWebhook(id: string, input: Pick<Webhook, "url" | "events" | "applicationName"> & { signingSecret?: string }): Promise<Webhook>;
  setWebhookStatus(id: string, status: Webhook["status"]): Promise<void>;
  deleteWebhook(id: string): Promise<void>;
  testWebhook(id: string): Promise<WebhookDelivery>;
  listUsers(actor: SenderIdentityActor, query: UserListQuery, targetTenantId?: string): Promise<Paginated<PortalUser>>;
  inviteUser(actor: SenderIdentityActor, input: CreatePortalUserInput, targetTenantId?: string): Promise<PortalUser>;
  updateUser(actor: SenderIdentityActor, id: string, input: UpdatePortalUserProfileInput, targetTenantId?: string): Promise<PortalUser>;
  setUserRole(actor: SenderIdentityActor, id: string, role: TenantUserRole, targetTenantId?: string): Promise<PortalUser>;
  setUserStatus(actor: SenderIdentityActor, id: string, status: UserStatus, targetTenantId?: string): Promise<PortalUser>;
  getSettings(): Promise<TenantSettings>;
  updateSettings(input: TenantSettings): Promise<TenantSettings>;
  getReport(actor: SenderIdentityActor, tenantId?: string): Promise<ReportSummary>;
  listPlans(query?: PlanListQuery): Promise<Paginated<Plan>>;
  getPlan(id: string): Promise<Plan>;
  createPlan(input: Omit<Plan, "id" | "tenants">): Promise<Plan>;
  updatePlan(id: string, input: Omit<Plan, "id" | "tenants">, baseline?: Plan): Promise<Plan>;
  setPlanStatus(id: string, status: Plan["status"]): Promise<void>;
  listChannels(): Promise<ChannelConfig[]>;
  setChannelEnabled(channel: ChannelConfig["channel"], enabled: boolean): Promise<void>;
  listRoutingRules(): Promise<RoutingRule[]>;
  createRoutingRule(input: Omit<RoutingRule, "id">): Promise<RoutingRule>;
  updateRoutingRule(id: string, input: Omit<RoutingRule, "id">): Promise<RoutingRule>;
  setRoutingRuleStatus(id: string, status: RoutingRule["status"]): Promise<void>;
  listPlatformClients(params: PlatformApiClientListQuery, actor: SenderIdentityActor): Promise<Paginated<PlatformApiClient>>;
  updatePlatformClient(actor: SenderIdentityActor, id: string, rateLimit: number): Promise<PlatformApiClient>;
  setPlatformClientStatus(actor: SenderIdentityActor, id: string, status: "active" | "revoked"): Promise<void>;
  listSenderIdentities(actor: SenderIdentityActor, query: SenderIdentityListQuery): Promise<Paginated<SenderIdentity>>;
  listSenderIdentityReadPage(actor: SenderIdentityActor, query: SenderIdentityListQuery, tenantId?: string): Promise<Paginated<SenderIdentityRead>>;
  listAllTenantSenderIdentityReadPage(actor: SenderIdentityActor, query: SenderIdentityListQuery): Promise<Paginated<PlatformSenderIdentityRead>>;
    /** Actor context is mock-only; HTTP implementations must derive tenant and role claims from authentication. */
  getSenderIdentity(actor: SenderIdentityActor, id: string): Promise<SenderIdentity | null>;
  getSenderIdentityRead(actor: SenderIdentityActor, id: string, tenantId?: string): Promise<SenderIdentityRead | null>;
  listSendableSenderIdentities(actor: SenderIdentityActor, applicationId: string, channel: SendMessageInput["channel"]): Promise<SenderIdentity[]>;
  createSenderIdentity(actor: SenderIdentityActor, input: SenderIdentityInput): Promise<SenderIdentity>;
  updateSenderIdentity(actor: SenderIdentityActor, id: string, input: SenderIdentityInput): Promise<SenderIdentity>;
  submitSenderIdentity(actor: SenderIdentityActor, id: string): Promise<SenderIdentity>;
  startSenderIdentityVerification(actor: SenderIdentityActor, id: string): Promise<SenderIdentity>;
  setSenderIdentityVerification(actor: SenderIdentityActor, id: string, result: { status: Extract<SenderIdentityVerificationStatus, "verified" | "rejected">; reason?: string }): Promise<SenderIdentity>;
  setSenderIdentityOperationalStatus(actor: SenderIdentityActor, id: string, action: "activate" | "suspend" | "reactivate", reason?: string): Promise<SenderIdentity>;
  listConfig(): Promise<ConfigParam[]>;
  updateConfig(key: string, value: string): Promise<ConfigParam>;
}

const portalConfig = resolvePortalConfig(readClientEnv());

export const apiMode = portalConfig.mode;

export const api: DolfConnectApi = selectPortalApi(portalConfig, createMockApi, () =>
  createLiveApi({
    apiBaseUrl: portalConfig.ok && portalConfig.mode === "live" ? portalConfig.apiBaseUrl : null,
    getAccessToken: getCachedAccessToken,
  }),
);
