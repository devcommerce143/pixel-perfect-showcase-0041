/** Typed models mirroring the Dolf Connect API contract (presentation-layer view). */

export type Channel = "sms" | "whatsapp" | "email";

export type MessageStatus =
  | "queued"
  | "processing"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "rejected";

export interface MessageEvent {
  status: MessageStatus | "accepted";
  at: string;
}

export interface Message {
  id: string;
  channel: Channel;
  recipient: string;
  applicationId: string;
  applicationName: string;
  templateName: string | null;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  tenantName: string;
  correlationId: string;
  segments: number;
  source: "api" | "portal" | "bulk";
  bulkJobId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  preview: string;
  events: MessageEvent[];
}

export type TemplateStatus = "approved" | "pending" | "rejected" | "draft";
export interface Template {
  id: string;
  name: string;
  channel: Channel;
  category: "Authentication" | "Transactional" | "Notification" | "Marketing";
  language: "en" | "ar";
  status: TemplateStatus;
  version: number;
  updatedAt: string;
  body: string;
}

export interface Application {
  id: string;
  name: string;
  environment: "production" | "sandbox";
  status: "active" | "disabled";
  channels: Channel[];
  credentialCount: number;
  createdAt: string;
  lastActivityAt: string;
}

export interface ApiCredential {
  id: string;
  applicationName: string;
  clientId: string;
  keyPrefix: string;
  status: "active" | "revoked" | "expired";
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  actorType: "user" | "service";
  action: string;
  resource: string;
  result: "success" | "failure";
  ip: string;
}

export interface Tenant {
  id: string;
  name: string;
  plan: string;
  status: "active" | "suspended" | "trial";
  users: number;
  messages30d: number;
  quotaPct: number;
  region: string;
  createdAt: string;
}

export interface Provider {
  id: string;
  name: string;
  channel: Channel;
  type: "Primary" | "Failover";
  status: "healthy" | "degraded" | "unavailable";
  latencyMs: number;
  successRate: number;
  priority: number;
  region: string;
  checkedAt: string;
}

export interface TrendPoint {
  date: string;
  delivered: number;
  failed: number;
  pending: number;
}

export interface DashboardSummary {
  kpis: {
    total: number;
    delivered: number;
    pending: number;
    failed: number;
    deliveryRate: number;
    totalDeltaPct: number;
  };
  trend: TrendPoint[];
  channels: { channel: Channel; count: number }[];
  quota: { used: number; limit: number };
}

export interface UsageSummary {
  plan: string;
  periodStart: string;
  periodEnd: string;
  channels: { channel: Channel; used: number; limit: number }[];
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  channel?: Channel | "all";
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SendMessageInput {
  channel: Channel;
  applicationId: string;
  recipient: string;
  templateId: string | null;
  subject?: string;
  body: string;
  idempotencyKey: string;
}

export interface BulkJob {
  id: string;
  name: string;
  channel: Channel;
  applicationName: string;
  templateName: string | null;
  status: "scheduled" | "queued" | "processing" | "completed" | "partial" | "failed";
  total: number;
  delivered: number;
  failed: number;
  createdAt: string;
  createdBy: string;
}
export interface CreateBulkJobInput {
  name: string;
  channel: Channel;
  applicationId: string;
  templateId: string | null;
  recipients: number;
  idempotencyKey: string;
}

export type WebhookEvent = "message.sent" | "message.delivered" | "message.failed" | "message.read" | "bulk_job.completed" | "template.status_changed";
export interface Webhook {
  id: string;
  url: string;
  applicationName: string;
  events: WebhookEvent[];
  status: "active" | "disabled";
  lastDeliveryAt: string | null;
  successRate: number;
}

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: "client_admin" | "operator" | "viewer";
  status: "active" | "invited" | "disabled";
  mfa: boolean;
  lastLoginAt: string | null;
}

export interface TenantSettings {
  organizationName: string;
  defaultLanguage: "en" | "ar";
  timezone: string;
  quotaAlerts: number[];
  alertEmails: string;
  mfaRequired: boolean;
  ipAllowlist: string;
  retentionDays: number;
}

export interface ReportSummary {
  byStatus: { status: MessageStatus; count: number }[];
  byApplication: { applicationName: string; count: number; failed: number }[];
  sampleSize: number;
}

export interface Plan {
  id: string;
  name: string;
  status: "active" | "draft";
  tenants: number;
  entitlements: { channel: Channel; monthly: number }[];
  features: string[];
}

export interface ChannelConfig {
  channel: Channel;
  enabled: boolean;
  providers: number;
  tenants: number;
  senderIds: number;
  volume30d: number;
}

export interface RoutingRule {
  id: string;
  name: string;
  channel: Channel;
  priority: number;
  condition: string;
  primaryProvider: string;
  failoverProvider: string | null;
  retry: string;
  status: "active" | "disabled";
}

export interface PlatformApiClient {
  id: string;
  clientId: string;
  tenantName: string;
  applicationName: string;
  status: "active" | "revoked" | "expired";
  rateLimit: number;
  lastUsedAt: string | null;
}

export interface ConfigParam {
  key: string;
  value: string;
  category: string;
  description: string;
}
