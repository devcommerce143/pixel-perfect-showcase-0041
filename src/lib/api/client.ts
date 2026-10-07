import type {
  BulkJob,
  BulkJobListQuery,
  BulkSuppressionCandidate,
  ChannelConfig,
  ConfigParam,
  CreateBulkJobInput,
  Plan,
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
  DashboardSummary,
  ListParams,
  SenderIdentityListQuery,
  TenantListQuery,
  TenantDirectoryItem,
  TenantUpsertInput,
  TemplateListQuery,
  UserListQuery,
  Message,
  Paginated,
  Provider,
  ProviderConfigInput,
  ProviderUsageBilling,
  ProviderTestResult,
  SenderIdentity,
  SenderIdentityActor,
  SenderIdentityFilters,
  SenderIdentityInput,
  SenderIdentityVerificationStatus,
  SendMessageInput,
  Template,
  Tenant,
  TenantUsageTableQuery,
  UsageSummary,
} from "./types";
import { createMockApi } from "./mock/mock-api";

/**
 * Contract for the Dolf Connect API as consumed by the web portal.
 * Tenant scope is derived by the backend from the caller's token, never sent by the UI.
 * Replace the mock implementation with an HTTP implementation (via the API gateway)
 * without changing any screen.
 */
export interface DolfConnectApi {
  getDashboard(): Promise<DashboardSummary>;
  listMessages(params: ListParams, actor: SenderIdentityActor): Promise<Paginated<Message>>;
  getMessage(id: string, actor: SenderIdentityActor, tenantId?: string): Promise<Message | null>;
  /** The actor is mock-only; an HTTP implementation must derive tenant/role claims from the authenticated token. */
  sendMessage(input: SendMessageInput, actor: SenderIdentityActor): Promise<{ id: string; status: "accepted" }>;
  listTemplates(params: TemplateListQuery, actor: SenderIdentityActor): Promise<Paginated<Template>>;
  createTemplate(actor: SenderIdentityActor, input: Pick<Template, "name" | "channel" | "category" | "language" | "subject" | "body">): Promise<Template>;
  updateTemplate(actor: SenderIdentityActor, id: string, input: Pick<Template, "name" | "channel" | "category" | "language" | "subject" | "body">): Promise<Template>;
  submitTemplateForApproval(actor: SenderIdentityActor, id: string): Promise<Template>;
  activateTemplate(actor: SenderIdentityActor, id: string): Promise<Template>;
  deactivateTemplate(actor: SenderIdentityActor, id: string): Promise<Template>;
  listApplications(actor: SenderIdentityActor, tenantId?: string): Promise<Application[]>;
  listApplicationsPage(actor: SenderIdentityActor, query: ApplicationListQuery): Promise<Paginated<Application>>;
  createApplication(actor: SenderIdentityActor, input: Pick<Application, "tenantId" | "name" | "environment" | "channels" | "scopes">): Promise<Application>;
  updateApplication(actor: SenderIdentityActor, id: string, input: Pick<Application, "name" | "environment" | "channels" | "scopes">): Promise<Application>;
  setApplicationStatus(actor: SenderIdentityActor, id: string, status: Application["status"]): Promise<void>;
  listCredentials(actor: SenderIdentityActor, query: ApiCredentialListQuery): Promise<Paginated<ApiCredential>>;
  createCredential(actor: SenderIdentityActor, input: { applicationId: string; scopes: string[]; environment?: Application["environment"]; expiresAt?: string | null; rateLimit?: number | null }): Promise<{ credential: ApiCredential; secret: string }>;
  rotateCredential(actor: SenderIdentityActor, id: string): Promise<{ credential: ApiCredential; secret: string }>;
  revokeCredential(actor: SenderIdentityActor, id: string, reason?: string): Promise<void>;
  listAuditEvents(params: ListParams, actor: SenderIdentityActor): Promise<Paginated<AuditEvent>>;
  getUsage(actor: SenderIdentityActor, tenantId?: string, tableQuery?: TenantUsageTableQuery): Promise<UsageSummary>;
  /** Platform scope (super admin only). */
  listTenants(params: TenantListQuery): Promise<Paginated<TenantDirectoryItem>>;
  createTenant(input: TenantUpsertInput): Promise<TenantDirectoryItem>;
  updateTenant(id: string, input: TenantUpsertInput): Promise<TenantDirectoryItem>;
  setTenantStatus(id: string, status: Tenant["status"]): Promise<void>;
  listProviders(): Promise<Provider[]>;
  getProviderUsageBilling(actor: SenderIdentityActor, providerId: string): Promise<ProviderUsageBilling | null>;
  createProvider(input: ProviderConfigInput): Promise<Provider>;
  updateProvider(id: string, input: ProviderConfigInput): Promise<Provider>;
  setProviderEnabled(id: string, enabled: boolean): Promise<void>;
  testProviderConnection(id: string): Promise<ProviderTestResult>;
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
  listUsers(actor: SenderIdentityActor, query: UserListQuery): Promise<Paginated<PortalUser>>;
  inviteUser(actor: SenderIdentityActor, input: Pick<PortalUser, "name" | "firstName" | "lastName" | "firstNameArabic" | "lastNameArabic" | "email" | "mobileNumber" | "jobTitle" | "department" | "preferredLanguage" | "role"> & { tenantId?: string }): Promise<PortalUser>;
  updateUser(actor: SenderIdentityActor, id: string, input: Pick<PortalUser, "name" | "firstName" | "lastName" | "firstNameArabic" | "lastNameArabic" | "email" | "mobileNumber" | "jobTitle" | "department" | "preferredLanguage" | "role">): Promise<PortalUser>;
  setUserStatus(actor: SenderIdentityActor, id: string, status: "active" | "disabled"): Promise<void>;
  resendInvitation(actor: SenderIdentityActor, id: string): Promise<void>;
  getSettings(): Promise<TenantSettings>;
  updateSettings(input: TenantSettings): Promise<TenantSettings>;
  getReport(actor: SenderIdentityActor, tenantId?: string): Promise<ReportSummary>;
  listPlans(): Promise<Plan[]>;
  createPlan(input: Omit<Plan, "id" | "tenants">): Promise<Plan>;
  updatePlan(id: string, input: Omit<Plan, "id" | "tenants">): Promise<Plan>;
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
    /** Actor context is mock-only; HTTP implementations must derive tenant and role claims from authentication. */
  getSenderIdentity(actor: SenderIdentityActor, id: string): Promise<SenderIdentity | null>;
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

export const api: DolfConnectApi = createMockApi();
