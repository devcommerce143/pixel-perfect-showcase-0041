import type { BulkJob, ChannelConfig, ConfigParam, Plan, PlatformApiClient, PortalUser, RoutingRule, TenantSettings, Webhook } from "../types";
import { BASE_TIME, TENANTS } from "./mock-data";

const MIN = 60_000;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

export const BULK_JOBS: BulkJob[] = [
  { id: "BLK-20261001-00072", name: "October statements notice", channel: "email", applicationName: "Customer Portal", templateName: "statement_ready", status: "processing", total: 48_200, delivered: 31_870, failed: 412, createdAt: iso(BASE_TIME - 40 * MIN), createdBy: "Noura Al-Qahtani" },
  { id: "BLK-20261001-00071", name: "Card dispatch batch 14", channel: "sms", applicationName: "Dolf CRM", templateName: "card_dispatch", status: "completed", total: 3_120, delivered: 3_066, failed: 54, createdAt: iso(BASE_TIME - 5 * 60 * MIN), createdBy: "Faisal Al-Harbi" },
  { id: "BLK-20260930-00070", name: "Payment reminders Q4", channel: "whatsapp", applicationName: "Dolf CRM", templateName: "payment_confirmation", status: "partial", total: 9_800, delivered: 8_430, failed: 1_370, createdAt: iso(BASE_TIME - 1 * DAY), createdBy: "Noura Al-Qahtani" },
  { id: "BLK-20260929-00069", name: "Course enrolment wave 3", channel: "email", applicationName: "Dolf LMS", templateName: "course_enrolment", status: "completed", total: 1_450, delivered: 1_441, failed: 9, createdAt: iso(BASE_TIME - 2 * DAY), createdBy: "Reem Al-Dosari" },
  { id: "BLK-20261002-00073", name: "Branch closure notice", channel: "sms", applicationName: "Customer Mobile App", templateName: null, status: "scheduled", total: 12_000, delivered: 0, failed: 0, createdAt: iso(BASE_TIME - 15 * MIN), createdBy: "Faisal Al-Harbi" },
  { id: "BLK-20260926-00068", name: "Ramadan pre-announcement", channel: "email", applicationName: "Customer Portal", templateName: null, status: "failed", total: 22_000, delivered: 0, failed: 22_000, createdAt: iso(BASE_TIME - 5 * DAY), createdBy: "Saad Al-Otaibi" },
];

export const WEBHOOKS: Webhook[] = [
  { id: "WHK-0021", url: "https://crm.alnoor-fs.example/hooks/dolf", applicationName: "Dolf CRM", events: ["message.delivered", "message.failed"], status: "active", lastDeliveryAt: iso(BASE_TIME - 2 * MIN), successRate: 99.6 },
  { id: "WHK-0024", url: "https://lms.alnoor-fs.example/api/notify/status", applicationName: "Dolf LMS", events: ["message.delivered", "message.failed", "message.read"], status: "active", lastDeliveryAt: iso(BASE_TIME - 9 * MIN), successRate: 97.2 },
  { id: "WHK-0030", url: "https://portal.alnoor-fs.example/webhooks/bulk", applicationName: "Customer Portal", events: ["bulk_job.completed"], status: "active", lastDeliveryAt: iso(BASE_TIME - 5 * 60 * MIN), successRate: 100 },
  { id: "WHK-0017", url: "https://kiosk.alnoor-fs.example/cb", applicationName: "Branch Kiosk Integration", events: ["message.sent"], status: "disabled", lastDeliveryAt: iso(BASE_TIME - 45 * DAY), successRate: 0 },
];

export const USERS: PortalUser[] = [
  { id: "usr-0101", name: "Noura Al-Qahtani", email: "n.alqahtani@alnoor-fs.example", role: "client_admin", status: "active", mfa: true, lastLoginAt: iso(BASE_TIME - 12 * MIN) },
  { id: "usr-0118", name: "Faisal Al-Harbi", email: "f.alharbi@alnoor-fs.example", role: "operator", status: "active", mfa: true, lastLoginAt: iso(BASE_TIME - 3 * 60 * MIN) },
  { id: "usr-0134", name: "Reem Al-Dosari", email: "r.aldosari@alnoor-fs.example", role: "operator", status: "active", mfa: false, lastLoginAt: iso(BASE_TIME - 1 * DAY) },
  { id: "usr-0150", name: "Saad Al-Otaibi", email: "s.alotaibi@alnoor-fs.example", role: "viewer", status: "active", mfa: true, lastLoginAt: iso(BASE_TIME - 4 * DAY) },
  { id: "usr-0163", name: "Hessa Al-Shehri", email: "h.alshehri@alnoor-fs.example", role: "viewer", status: "invited", mfa: false, lastLoginAt: null },
  { id: "usr-0091", name: "Omar Al-Malki", email: "o.almalki@alnoor-fs.example", role: "operator", status: "disabled", mfa: true, lastLoginAt: iso(BASE_TIME - 60 * DAY) },
];

export const SETTINGS: TenantSettings = {
  organizationName: "Al Noor Financial Services",
  defaultLanguage: "ar",
  timezone: "Asia/Riyadh",
  quotaAlerts: [80, 90, 100],
  alertEmails: "n.alqahtani@alnoor-fs.example",
  mfaRequired: true,
  ipAllowlist: "10.20.0.0/16\n172.31.4.0/24",
  retentionDays: 90,
};

export const PLANS: Plan[] = [
  { id: "PLN-STARTER", name: "Starter", status: "active", tenants: 2, entitlements: [{ channel: "sms", monthly: 25_000 }, { channel: "whatsapp", monthly: 5_000 }, { channel: "email", monthly: 20_000 }], features: ["Portal sending", "REST API", "Standard support"] },
  { id: "PLN-BUSINESS", name: "Business", status: "active", tenants: 5, entitlements: [{ channel: "sms", monthly: 120_000 }, { channel: "whatsapp", monthly: 40_000 }, { channel: "email", monthly: 80_000 }], features: ["Bulk jobs", "Webhooks", "Templates approval", "Business-hours support"] },
  { id: "PLN-ENTERPRISE", name: "Enterprise", status: "active", tenants: 3, entitlements: [{ channel: "sms", monthly: 260_000 }, { channel: "whatsapp", monthly: 150_000 }, { channel: "email", monthly: 90_000 }], features: ["Dedicated sender IDs", "IP allowlisting", "Audit export", "24/7 support"] },
  { id: "PLN-GOV", name: "Government", status: "draft", tenants: 0, entitlements: [{ channel: "sms", monthly: 500_000 }, { channel: "whatsapp", monthly: 0 }, { channel: "email", monthly: 200_000 }], features: ["In-kingdom data residency", "Extended retention"] },
];

export const CHANNELS: ChannelConfig[] = [
  { channel: "sms", enabled: true, providers: 2, tenants: 10, senderIds: 34, volume30d: 1_240_330 },
  { channel: "whatsapp", enabled: true, providers: 1, tenants: 7, senderIds: 9, volume30d: 612_870 },
  { channel: "email", enabled: true, providers: 2, tenants: 9, senderIds: 21, volume30d: 432_830 },
];

export const ROUTING: RoutingRule[] = [
  { id: "RTE-001", name: "SMS OTP priority", channel: "sms", priority: 1, condition: "category = Authentication", primaryProvider: "SMS Gateway A", failoverProvider: "SMS Gateway B", retry: "2 × 15s", status: "active" },
  { id: "RTE-002", name: "SMS default", channel: "sms", priority: 10, condition: "*", primaryProvider: "SMS Gateway A", failoverProvider: "SMS Gateway B", retry: "3 × 60s", status: "active" },
  { id: "RTE-003", name: "WhatsApp default", channel: "whatsapp", priority: 10, condition: "*", primaryProvider: "WhatsApp Business Platform", failoverProvider: null, retry: "3 × 120s", status: "active" },
  { id: "RTE-004", name: "Email transactional", channel: "email", priority: 5, condition: "category ∈ {Transactional, Authentication}", primaryProvider: "Email Relay A", failoverProvider: "Email Relay B", retry: "3 × 300s", status: "active" },
  { id: "RTE-005", name: "Email marketing (ME relay)", channel: "email", priority: 20, condition: "category = Marketing", primaryProvider: "Email Relay B", failoverProvider: "Email Relay A", retry: "1 × 600s", status: "disabled" },
];

export const PLATFORM_CLIENTS: PlatformApiClient[] = TENANTS.flatMap((t, i) =>
  ["prod", "uat"].slice(0, i % 3 === 0 ? 2 : 1).map((env, j) => ({
    id: `CLT-${String(1000 + i * 7 + j).padStart(5, "0")}`,
    clientId: `dc-${t.id.toLowerCase()}-${env}`,
    tenantName: t.name,
    applicationName: env === "prod" ? "Core integration" : "UAT integration",
    status: t.status === "suspended" ? ("revoked" as const) : i === 6 && j === 0 ? ("expired" as const) : ("active" as const),
    rateLimit: t.plan === "Enterprise" ? 200 : t.plan === "Business" ? 80 : 20,
    lastUsedAt: t.status === "suspended" ? null : iso(BASE_TIME - (i + 1) * (j + 1) * 7 * MIN),
  })),
);

export const CONFIG: ConfigParam[] = [
  { key: "messaging.sms.max_segments", value: "6", category: "Messaging", description: "Maximum concatenated SMS segments per message" },
  { key: "messaging.retry.max_attempts", value: "3", category: "Messaging", description: "Default delivery retry attempts before failover" },
  { key: "messaging.idempotency.ttl", value: "24h", category: "Messaging", description: "Retention window for idempotency keys" },
  { key: "bulk.max_recipients", value: "500000", category: "Bulk", description: "Maximum recipients per bulk job" },
  { key: "bulk.throughput_per_tenant", value: "300/s", category: "Bulk", description: "Per-tenant bulk dispatch rate" },
  { key: "api.rate_limit.default", value: "20/s", category: "API", description: "Default per-client rate limit" },
  { key: "api.token.ttl", value: "3600s", category: "API", description: "Access token lifetime (Keycloak)" },
  { key: "webhook.timeout", value: "5s", category: "Webhooks", description: "Callback request timeout" },
  { key: "webhook.retry.schedule", value: "1m, 5m, 30m, 2h", category: "Webhooks", description: "Callback retry back-off" },
  { key: "retention.message_content", value: "90d", category: "Data", description: "Default message content retention" },
  { key: "retention.audit", value: "7y", category: "Data", description: "Audit log retention" },
];
