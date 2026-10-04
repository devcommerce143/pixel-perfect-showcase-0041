import type {
  BulkJob,
  ChannelConfig,
  ConfigParam,
  CreateBulkJobInput,
  Plan,
  PlatformApiClient,
  PortalUser,
  ReportSummary,
  RoutingRule,
  TenantSettings,
  Webhook,
  WebhookDelivery,
  ApiCredential,
  Application,
  AuditEvent,
  DashboardSummary,
  ListParams,
  Message,
  Paginated,
  Provider,
  ProviderConfigInput,
  SendMessageInput,
  Template,
  Tenant,
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
  listMessages(params: ListParams): Promise<Paginated<Message>>;
  getMessage(id: string): Promise<Message | null>;
  sendMessage(input: SendMessageInput): Promise<{ id: string; status: "accepted" }>;
  listTemplates(params: ListParams): Promise<Paginated<Template>>;
  createTemplate(input: Pick<Template, "name" | "channel" | "category" | "language" | "subject" | "body">): Promise<Template>;
  updateTemplate(id: string, input: Pick<Template, "name" | "channel" | "category" | "language" | "subject" | "body">): Promise<Template>;
  listApplications(): Promise<Application[]>;
  createApplication(input: Pick<Application, "name" | "environment" | "channels" | "scopes">): Promise<Application>;
  updateApplication(id: string, input: Pick<Application, "name" | "environment" | "channels" | "scopes">): Promise<Application>;
  setApplicationStatus(id: string, status: Application["status"]): Promise<void>;
  listCredentials(): Promise<ApiCredential[]>;
  createCredential(input: { applicationId: string; scopes: string[] }): Promise<{ credential: ApiCredential; secret: string }>;
  rotateCredential(id: string): Promise<{ credential: ApiCredential; secret: string }>;
  revokeCredential(id: string): Promise<void>;
  listAuditEvents(params: ListParams): Promise<Paginated<AuditEvent>>;
  getUsage(): Promise<UsageSummary>;
  /** Platform scope (super admin only). */
  listTenants(params: ListParams): Promise<Paginated<Tenant>>;
  createTenant(input: Omit<Tenant, "id" | "users" | "applications" | "messages30d" | "quotaPct" | "createdAt">): Promise<Tenant>;
  updateTenant(id: string, input: Omit<Tenant, "id" | "users" | "applications" | "messages30d" | "quotaPct" | "createdAt">): Promise<Tenant>;
  setTenantStatus(id: string, status: Tenant["status"]): Promise<void>;
  listProviders(): Promise<Provider[]>;
  createProvider(input: ProviderConfigInput & { secret: string }): Promise<Provider>;
  updateProvider(id: string, input: ProviderConfigInput & { secret?: string }): Promise<Provider>;
  setProviderEnabled(id: string, enabled: boolean): Promise<void>;
  testProviderConnection(id: string): Promise<{ success: boolean; latencyMs: number }>;
  listBulkJobs(): Promise<BulkJob[]>;
  createBulkJob(input: CreateBulkJobInput): Promise<BulkJob>;
  listWebhooks(): Promise<Webhook[]>;
  createWebhook(input: Pick<Webhook, "url" | "events" | "applicationName">): Promise<{ webhook: Webhook; signingSecret: string }>;
  updateWebhook(id: string, input: Pick<Webhook, "url" | "events" | "applicationName"> & { signingSecret?: string }): Promise<Webhook>;
  setWebhookStatus(id: string, status: Webhook["status"]): Promise<void>;
  deleteWebhook(id: string): Promise<void>;
  testWebhook(id: string): Promise<WebhookDelivery>;
  listUsers(): Promise<PortalUser[]>;
  inviteUser(input: Pick<PortalUser, "name" | "email" | "role">): Promise<PortalUser>;
  updateUser(id: string, input: Pick<PortalUser, "name" | "email" | "role">): Promise<PortalUser>;
  setUserStatus(id: string, status: "active" | "disabled"): Promise<void>;
  resendInvitation(id: string): Promise<void>;
  getSettings(): Promise<TenantSettings>;
  updateSettings(input: TenantSettings): Promise<TenantSettings>;
  getReport(): Promise<ReportSummary>;
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
  listPlatformClients(params: ListParams): Promise<Paginated<PlatformApiClient>>;
  updatePlatformClient(id: string, rateLimit: number): Promise<PlatformApiClient>;
  setPlatformClientStatus(id: string, status: "active" | "revoked"): Promise<void>;
  listConfig(): Promise<ConfigParam[]>;
  updateConfig(key: string, value: string): Promise<ConfigParam>;
}

export const api: DolfConnectApi = createMockApi();
