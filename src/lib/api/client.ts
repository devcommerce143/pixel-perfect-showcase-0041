import type {
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
}

export const api: DolfConnectApi = createMockApi();
