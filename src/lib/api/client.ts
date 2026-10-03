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
  ApiCredential,
  Application,
  AuditEvent,
  DashboardSummary,
  ListParams,
  Message,
  Paginated,
  Provider,
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
  listApplications(): Promise<Application[]>;
  listCredentials(): Promise<ApiCredential[]>;
  revokeCredential(id: string): Promise<void>;
  listAuditEvents(params: ListParams): Promise<Paginated<AuditEvent>>;
  getUsage(): Promise<UsageSummary>;
  /** Platform scope (super admin only). */
  listTenants(params: ListParams): Promise<Paginated<Tenant>>;
  listProviders(): Promise<Provider[]>;
  listBulkJobs(): Promise<BulkJob[]>;
  createBulkJob(input: CreateBulkJobInput): Promise<BulkJob>;
  listWebhooks(): Promise<Webhook[]>;
  createWebhook(input: Pick<Webhook, "url" | "events" | "applicationName">): Promise<Webhook>;
  testWebhook(id: string): Promise<void>;
  listUsers(): Promise<PortalUser[]>;
  inviteUser(input: Pick<PortalUser, "name" | "email" | "role">): Promise<PortalUser>;
  getSettings(): Promise<TenantSettings>;
  updateSettings(input: TenantSettings): Promise<TenantSettings>;
  getReport(): Promise<ReportSummary>;
  listPlans(): Promise<Plan[]>;
  listChannels(): Promise<ChannelConfig[]>;
  setChannelEnabled(channel: ChannelConfig["channel"], enabled: boolean): Promise<void>;
  listRoutingRules(): Promise<RoutingRule[]>;
  listPlatformClients(params: ListParams): Promise<Paginated<PlatformApiClient>>;
  listConfig(): Promise<ConfigParam[]>;
}

export const api: DolfConnectApi = createMockApi();
