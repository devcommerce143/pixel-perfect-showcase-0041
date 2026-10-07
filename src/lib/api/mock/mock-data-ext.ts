import type { BulkJob, ChannelConfig, ConfigParam, Plan, PlatformApiClient, PortalUser, ProviderUsageBilling, RoutingRule, SenderIdentity, TenantSettings, Webhook } from "../types";
import { BASE_TIME, TENANTS } from "./mock-data";

const MIN = 60_000;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

export const BULK_JOBS: BulkJob[] = [
  { id: "BLK-20261001-00072", tenantId: "TEN-00012", tenantName: "Al Noor Financial Services", applicationId: "APP-00211", senderIdentityId: "SID-00003", senderIdentityName: "Al Noor Notifications", templateId: "TPL-0120", name: "October statements notice", channel: "email", applicationName: "Customer Portal", templateName: "statement_ready", status: "processing", total: 48_200, valid: 48_200, duplicates: 0, suppressed: 0, sent: 32_282, delivered: 31_870, failed: 412, pending: 15_918, estimatedUsage: 48_200, actualUsage: 32_282, createdAt: iso(BASE_TIME - 40 * MIN), createdBy: "Noura Al-Qahtani" },
  { id: "BLK-20261001-00071", tenantId: "TEN-00012", tenantName: "Al Noor Financial Services", applicationId: "APP-00187", senderIdentityId: "SID-00001", senderIdentityName: "Al Noor Financial Services", templateId: "TPL-0140", name: "Card dispatch batch 14", channel: "sms", applicationName: "Dolf CRM", templateName: "card_dispatch", status: "completed", total: 3_120, valid: 3_120, duplicates: 0, suppressed: 0, sent: 3_120, delivered: 3_066, failed: 54, pending: 0, estimatedUsage: 3_120, actualUsage: 3_120, createdAt: iso(BASE_TIME - 5 * 60 * MIN), createdBy: "Faisal Al-Harbi" },
  { id: "BLK-20260930-00070", tenantId: "TEN-00012", tenantName: "Al Noor Financial Services", applicationId: "APP-00187", senderIdentityId: "SID-00002", senderIdentityName: "Al Noor Banking", templateId: "TPL-0110", name: "Payment reminders Q4", channel: "whatsapp", applicationName: "Dolf CRM", templateName: "payment_confirmation", status: "partial", total: 9_800, valid: 9_800, duplicates: 0, suppressed: 0, sent: 9_800, delivered: 8_430, failed: 1_370, pending: 0, rejected: 0, estimatedUsage: 9_800, actualUsage: 9_800, createdAt: iso(BASE_TIME - 1 * DAY), createdBy: "Noura Al-Qahtani" },
  { id: "BLK-20260929-00069", tenantId: "TEN-00012", tenantName: "Al Noor Financial Services", applicationId: "APP-00182", senderIdentityId: "SID-00003", senderIdentityName: "Al Noor Notifications", templateId: "TPL-0121", name: "Course enrolment wave 3", channel: "email", applicationName: "Dolf LMS", templateName: "course_enrolment", status: "completed", total: 1_450, valid: 1_450, duplicates: 0, suppressed: 0, sent: 1_450, delivered: 1_441, failed: 9, pending: 0, estimatedUsage: 1_450, actualUsage: 1_450, createdAt: iso(BASE_TIME - 2 * DAY), createdBy: "Reem Al-Dosari" },
  { id: "BLK-20261002-00073", tenantId: "TEN-00012", tenantName: "Al Noor Financial Services", applicationId: "APP-00203", senderIdentityId: "SID-00001", senderIdentityName: "Al Noor Financial Services", templateId: null, name: "Branch closure notice", channel: "sms", applicationName: "Customer Mobile App", templateName: null, status: "scheduled", total: 12_000, valid: 12_000, duplicates: 0, suppressed: 0, sent: 0, delivered: 0, failed: 0, pending: 12_000, estimatedUsage: 12_000, actualUsage: null, createdAt: iso(BASE_TIME - 15 * MIN), createdBy: "Faisal Al-Harbi" },
  { id: "BLK-20260926-00068", tenantId: "TEN-00012", tenantName: "Al Noor Financial Services", applicationId: "APP-00211", senderIdentityId: "SID-00003", senderIdentityName: "Al Noor Notifications", templateId: null, name: "Ramadan pre-announcement", channel: "email", applicationName: "Customer Portal", templateName: null, status: "failed", total: 22_000, valid: 22_000, duplicates: 0, suppressed: 0, sent: 22_000, delivered: 0, failed: 22_000, pending: 0, estimatedUsage: 22_000, actualUsage: 22_000, createdAt: iso(BASE_TIME - 5 * DAY), createdBy: "Saad Al-Otaibi" },
];

export const WEBHOOKS: Webhook[] = [
  { id: "WHK-0021", url: "https://crm.alnoor-fs.example/hooks/dolf", applicationName: "Dolf CRM", events: ["message.delivered", "message.failed"], status: "active", signingConfigured: true, lastDeliveryAt: iso(BASE_TIME - 2 * MIN), successRate: 99.6, deliveries: [] },
  { id: "WHK-0024", url: "https://lms.alnoor-fs.example/api/notify/status", applicationName: "Dolf LMS", events: ["message.delivered", "message.failed", "message.read"], status: "active", signingConfigured: true, lastDeliveryAt: iso(BASE_TIME - 9 * MIN), successRate: 97.2, deliveries: [] },
  { id: "WHK-0030", url: "https://portal.alnoor-fs.example/webhooks/bulk", applicationName: "Customer Portal", events: ["bulk_job.completed"], status: "active", signingConfigured: true, lastDeliveryAt: iso(BASE_TIME - 5 * 60 * MIN), successRate: 100, deliveries: [] },
  { id: "WHK-0017", url: "https://kiosk.alnoor-fs.example/cb", applicationName: "Branch Kiosk Integration", events: ["message.sent"], status: "disabled", signingConfigured: true, lastDeliveryAt: iso(BASE_TIME - 45 * DAY), successRate: 0, deliveries: [] },
];

export const USERS: PortalUser[] = [
  { id: "usr-0101", tenantId: "TEN-00012", name: "Noura Al-Qahtani", firstName: "Noura", lastName: "Al-Qahtani", firstNameArabic: "نورة", lastNameArabic: "القهطاني", email: "n.alqahtani@alnoor-fs.example", mobileNumber: "+966500000001", jobTitle: "Operations Director", department: "Operations", preferredLanguage: "ar", role: "client_admin", status: "active", mfa: true, lastLoginAt: iso(BASE_TIME - 12 * MIN) },
  { id: "usr-0118", tenantId: "TEN-00012", name: "Faisal Al-Harbi", firstName: "Faisal", lastName: "Al-Harbi", firstNameArabic: "فيصل", lastNameArabic: "الحربي", email: "f.alharbi@alnoor-fs.example", mobileNumber: "+966500000002", jobTitle: "Messaging Lead", department: "Marketing", preferredLanguage: "ar", role: "operator", status: "active", mfa: true, lastLoginAt: iso(BASE_TIME - 3 * 60 * MIN) },
  { id: "usr-0134", tenantId: "TEN-00012", name: "Reem Al-Dosari", firstName: "Reem", lastName: "Al-Dosari", firstNameArabic: "ريم", lastNameArabic: "الدوسري", email: "r.aldosari@alnoor-fs.example", mobileNumber: "+966500000003", jobTitle: "CRM Analyst", department: "Customer Experience", preferredLanguage: "en", role: "operator", status: "active", mfa: false, lastLoginAt: iso(BASE_TIME - 1 * DAY) },
  { id: "usr-0150", tenantId: "TEN-00012", name: "Saad Al-Otaibi", firstName: "Saad", lastName: "Al-Otaibi", firstNameArabic: "سعد", lastNameArabic: "العتيبي", email: "s.alotaibi@alnoor-fs.example", mobileNumber: "+966500000004", jobTitle: "Reporting Analyst", department: "Insights", preferredLanguage: "en", role: "viewer", status: "active", mfa: true, lastLoginAt: iso(BASE_TIME - 4 * DAY) },
  { id: "usr-0163", tenantId: "TEN-00012", name: "Hessa Al-Shehri", firstName: "Hessa", lastName: "Al-Shehri", firstNameArabic: "هسة", lastNameArabic: "الشهري", email: "h.alshehri@alnoor-fs.example", mobileNumber: "+966500000005", jobTitle: "Audit Coordinator", department: "Risk & Audit", preferredLanguage: "ar", role: "viewer", status: "pending_activation", mfa: false, lastLoginAt: null },
  { id: "usr-0091", tenantId: "TEN-00012", name: "Omar Al-Malki", firstName: "Omar", lastName: "Al-Malki", firstNameArabic: "عمر", lastNameArabic: "الملكي", email: "o.almalki@alnoor-fs.example", mobileNumber: "+966500000006", jobTitle: "Support Specialist", department: "Support", preferredLanguage: "ar", role: "operator", status: "disabled", mfa: true, lastLoginAt: iso(BASE_TIME - 60 * DAY) },
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
  { id: "PLN-STANDARD", code: "STANDARD", name: "Standard", description: "Core messaging for smaller teams.", status: "active", tpsLimit: 10, tenants: 2, quotaPolicy: "hard_stop", entitlements: [{ channel: "sms", enabled: true, monthly: 25_000 }, { channel: "whatsapp", enabled: false, monthly: 5_000 }, { channel: "email", enabled: true, monthly: 20_000 }], features: ["api_access", "reporting"] },
  { id: "PLN-BUSINESS", code: "BUSINESS", name: "Business", description: "Higher volumes and integrated workflows.", status: "active", tpsLimit: 50, tenants: 5, quotaPolicy: "soft_cap", entitlements: [{ channel: "sms", enabled: true, monthly: 120_000 }, { channel: "whatsapp", enabled: true, monthly: 40_000 }, { channel: "email", enabled: true, monthly: 80_000 }], features: ["api_access", "bulk_messaging", "webhooks", "reporting"] },
  { id: "PLN-ENTERPRISE", code: "ENTERPRISE", name: "Enterprise", description: "Flexible messaging for large organizations.", status: "active", tpsLimit: 200, tenants: 3, quotaPolicy: "soft_cap", entitlements: [{ channel: "sms", enabled: true, monthly: 260_000 }, { channel: "whatsapp", enabled: true, monthly: 150_000 }, { channel: "email", enabled: true, monthly: 90_000 }], features: ["api_access", "bulk_messaging", "webhooks", "reporting", "audit_export", "dedicated_sender_identities"] },
  { id: "PLN-GOV", code: "GOV", name: "Government", description: "Government messaging with regional requirements.", status: "draft", tpsLimit: 100, tenants: 0, quotaPolicy: "hard_stop", entitlements: [{ channel: "sms", enabled: true, monthly: 500_000 }, { channel: "whatsapp", enabled: false, monthly: 0 }, { channel: "email", enabled: true, monthly: 200_000 }], features: ["api_access", "bulk_messaging", "webhooks", "reporting"] },
];

export const CHANNELS: ChannelConfig[] = [
  { channel: "sms", enabled: true, providers: 2, tenants: 10, senderIds: 34, volume30d: 1_240_330 },
  { channel: "whatsapp", enabled: true, providers: 1, tenants: 7, senderIds: 9, volume30d: 612_870 },
  { channel: "email", enabled: true, providers: 2, tenants: 9, senderIds: 21, volume30d: 432_830 },
];

export const PROVIDER_USAGE_BILLING: Record<string, ProviderUsageBilling> = {
  "PRV-SMS-01": {
    source: "development_sample",
    periodStart: "2026-10-01T00:00:00.000Z",
    periodEnd: "2026-10-31T00:00:00.000Z",
    trafficRouted: { amount: 87_420, unit: "messages" },
    billableUsage: { amount: 102_840, unit: "sms_segments" },
    allowance: { total: 150_000, used: 102_840, remaining: 47_160, unit: "sms_segments" },
  },
  "PRV-WA-01": {
    source: "development_sample",
    periodStart: "2026-10-01T00:00:00.000Z",
    periodEnd: "2026-10-31T00:00:00.000Z",
    trafficRouted: { amount: 31_800, unit: "messages" },
    billableUsage: { amount: 29_500, unit: "billable_messages" },
    categories: [
      { name: "marketing", messages: 4_200 },
      { name: "utility", messages: 18_600 },
      { name: "authentication", messages: 5_400 },
      { name: "service", messages: 3_600 },
    ],
  },
};

export const ROUTING: RoutingRule[] = [
  { id: "RTE-001", name: "SMS OTP priority", channel: "sms", priority: 1, condition: { mode: "categories", categories: ["authentication"] }, primaryProvider: "Taqnyat — Saudi SMS", failoverProvider: "Infobip — SMS", retryPolicy: { attempts: 2, intervalSeconds: 15 }, failoverTriggers: ["connection_timeout", "network_error", "http_5xx", "provider_unavailable"], status: "active" },
  { id: "RTE-002", name: "SMS default", channel: "sms", priority: 10, condition: { mode: "all" }, primaryProvider: "Taqnyat — Saudi SMS", failoverProvider: "Infobip — SMS", retryPolicy: { attempts: 3, intervalSeconds: 60 }, failoverTriggers: ["connection_timeout", "network_error", "http_5xx", "provider_unavailable", "rate_limited"], status: "active" },
  { id: "RTE-003", name: "WhatsApp default", channel: "whatsapp", priority: 10, condition: { mode: "all" }, primaryProvider: "Meta Cloud API — WhatsApp", failoverProvider: null, retryPolicy: { attempts: 3, intervalSeconds: 120 }, failoverTriggers: ["connection_timeout", "network_error", "http_5xx", "provider_unavailable"], status: "active" },
  { id: "RTE-004", name: "Email transactional", channel: "email", priority: 5, condition: { mode: "categories", categories: ["transactional", "authentication"] }, primaryProvider: "AWS SES — Email", failoverProvider: "SMTP Relay — Email", retryPolicy: { attempts: 3, intervalSeconds: 300 }, failoverTriggers: ["connection_timeout", "network_error", "http_5xx", "provider_unavailable"], status: "active" },
  { id: "RTE-005", name: "Email marketing (ME relay)", channel: "email", priority: 20, condition: { mode: "categories", categories: ["marketing"] }, primaryProvider: "SMTP Relay — Email", failoverProvider: "AWS SES — Email", retryPolicy: { attempts: 1, intervalSeconds: 600 }, failoverTriggers: ["connection_timeout", "network_error", "provider_unavailable"], status: "disabled" },
  { id: "RTE-006", name: "Email default", channel: "email", priority: 100, condition: { mode: "all" }, primaryProvider: "AWS SES — Email", failoverProvider: null, retryPolicy: { attempts: 3, intervalSeconds: 300 }, failoverTriggers: ["connection_timeout", "network_error", "http_5xx", "provider_unavailable"], status: "active" },
];

export const SENDER_IDENTITIES: SenderIdentity[] = [
  { id: "SID-00001", tenantId: "TEN-00012", channel: "sms", identityType: "sms_sender_id", identityValue: "ALNOOR", displayName: "Al Noor Financial Services", countryMarket: "Saudi Arabia", providerReference: "TAQ-ALNOOR-01", verificationStatus: "verified", operationalStatus: "active", createdAt: "2026-08-11T10:00:00.000Z", createdBy: "Noura Al-Qahtani", updatedAt: "2026-08-13T12:30:00.000Z", submittedAt: "2026-08-11T11:00:00.000Z", verificationStartedAt: "2026-08-11T11:15:00.000Z", verifiedAt: "2026-08-13T12:00:00.000Z", rejectedAt: null, rejectionReason: null, activatedAt: "2026-08-13T12:30:00.000Z", suspendedAt: null, suspensionReason: null, history: [{ action: "created", at: "2026-08-11T10:00:00.000Z", actor: "Noura Al-Qahtani", note: null }, { action: "submitted", at: "2026-08-11T11:00:00.000Z", actor: "Noura Al-Qahtani", note: null }, { action: "verification_started", at: "2026-08-11T11:15:00.000Z", actor: "Khalid Al-Mutairi", note: null }, { action: "verified", at: "2026-08-13T12:00:00.000Z", actor: "Khalid Al-Mutairi", note: null }, { action: "activated", at: "2026-08-13T12:30:00.000Z", actor: "Khalid Al-Mutairi", note: null }] },
  { id: "SID-00002", tenantId: "TEN-00012", channel: "whatsapp", identityType: "whatsapp_business_number", identityValue: "+966550001111", displayName: "Al Noor Banking", businessDisplayName: "Al Noor Banking", phoneNumber: "+966550001111", countryCode: "+966", wabaId: "WABA-ALNOOR-01", phoneNumberId: "PHONE-ALNOOR-01", providerReference: "META-WABA-001", verificationStatus: "verified", operationalStatus: "active", createdAt: "2026-08-18T08:00:00.000Z", createdBy: "Noura Al-Qahtani", updatedAt: "2026-08-20T09:15:00.000Z", submittedAt: "2026-08-18T09:00:00.000Z", verificationStartedAt: "2026-08-18T09:20:00.000Z", verifiedAt: "2026-08-20T09:00:00.000Z", rejectedAt: null, rejectionReason: null, activatedAt: "2026-08-20T09:15:00.000Z", suspendedAt: null, suspensionReason: null, history: [{ action: "created", at: "2026-08-18T08:00:00.000Z", actor: "Noura Al-Qahtani", note: null }, { action: "submitted", at: "2026-08-18T09:00:00.000Z", actor: "Noura Al-Qahtani", note: null }, { action: "verification_started", at: "2026-08-18T09:20:00.000Z", actor: "Khalid Al-Mutairi", note: null }, { action: "verified", at: "2026-08-20T09:00:00.000Z", actor: "Khalid Al-Mutairi", note: null }, { action: "activated", at: "2026-08-20T09:15:00.000Z", actor: "Khalid Al-Mutairi", note: null }] },
  { id: "SID-00003", tenantId: "TEN-00012", channel: "email", identityType: "email_domain_sender", identityValue: "notifications@alnoor.com", displayName: "Al Noor Notifications", emailAddress: "notifications@alnoor.com", domain: "alnoor.com", domainVerificationStatus: "verified", spfStatus: "valid", dkimStatus: "valid", providerReference: "DNS-ALNOOR-01", verificationStatus: "verified", operationalStatus: "active", createdAt: "2026-08-21T10:00:00.000Z", createdBy: "Noura Al-Qahtani", updatedAt: "2026-08-23T10:00:00.000Z", submittedAt: "2026-08-21T11:00:00.000Z", verificationStartedAt: "2026-08-21T11:10:00.000Z", verifiedAt: "2026-08-23T09:30:00.000Z", rejectedAt: null, rejectionReason: null, activatedAt: "2026-08-23T10:00:00.000Z", suspendedAt: null, suspensionReason: null, history: [{ action: "created", at: "2026-08-21T10:00:00.000Z", actor: "Noura Al-Qahtani", note: null }, { action: "submitted", at: "2026-08-21T11:00:00.000Z", actor: "Noura Al-Qahtani", note: null }, { action: "verification_started", at: "2026-08-21T11:10:00.000Z", actor: "Khalid Al-Mutairi", note: null }, { action: "verified", at: "2026-08-23T09:30:00.000Z", actor: "Khalid Al-Mutairi", note: "Domain, SPF and DKIM verified in mock workflow." }, { action: "activated", at: "2026-08-23T10:00:00.000Z", actor: "Khalid Al-Mutairi", note: null }] },
  { id: "SID-00004", tenantId: "TEN-00012", channel: "sms", identityType: "sms_sender_id", identityValue: "ALNOORPAY", displayName: "Al Noor Payments", countryMarket: "Saudi Arabia", providerReference: null, verificationStatus: "draft", operationalStatus: "inactive", createdAt: "2026-10-04T09:00:00.000Z", createdBy: "Noura Al-Qahtani", updatedAt: "2026-10-04T09:00:00.000Z", submittedAt: null, verificationStartedAt: null, verifiedAt: null, rejectedAt: null, rejectionReason: null, activatedAt: null, suspendedAt: null, suspensionReason: null, history: [{ action: "created", at: "2026-10-04T09:00:00.000Z", actor: "Noura Al-Qahtani", note: null }] },
  { id: "SID-00005", tenantId: "TEN-00015", channel: "email", identityType: "email_domain_sender", identityValue: "offers@gulfretail.sa", displayName: "Gulf Retail Offers", emailAddress: "offers@gulfretail.sa", domain: "gulfretail.sa", domainVerificationStatus: "pending", spfStatus: "pending", dkimStatus: "pending", providerReference: "DNS-GULF-02", verificationStatus: "pending_verification", operationalStatus: "inactive", createdAt: "2026-09-25T07:00:00.000Z", createdBy: "Gulf Retail Admin", updatedAt: "2026-09-26T08:00:00.000Z", submittedAt: "2026-09-25T08:00:00.000Z", verificationStartedAt: "2026-09-26T08:00:00.000Z", verifiedAt: null, rejectedAt: null, rejectionReason: null, activatedAt: null, suspendedAt: null, suspensionReason: null, history: [{ action: "created", at: "2026-09-25T07:00:00.000Z", actor: "Gulf Retail Admin", note: null }, { action: "submitted", at: "2026-09-25T08:00:00.000Z", actor: "Gulf Retail Admin", note: null }, { action: "verification_started", at: "2026-09-26T08:00:00.000Z", actor: "Khalid Al-Mutairi", note: null }] },
  { id: "SID-00006", tenantId: "TEN-00015", channel: "sms", identityType: "sms_sender_id", identityValue: "GULFRETAIL", displayName: "Gulf Retail Group", countryMarket: "Saudi Arabia", providerReference: "INF-GULF-04", verificationStatus: "verified", operationalStatus: "suspended", createdAt: "2026-07-10T10:00:00.000Z", createdBy: "Gulf Retail Admin", updatedAt: "2026-09-20T11:00:00.000Z", submittedAt: "2026-07-11T09:00:00.000Z", verificationStartedAt: "2026-07-11T09:15:00.000Z", verifiedAt: "2026-07-14T12:00:00.000Z", rejectedAt: null, rejectionReason: null, activatedAt: "2026-07-14T12:30:00.000Z", suspendedAt: "2026-09-20T11:00:00.000Z", suspensionReason: "Tenant requested temporary suspension.", history: [{ action: "created", at: "2026-07-10T10:00:00.000Z", actor: "Gulf Retail Admin", note: null }, { action: "submitted", at: "2026-07-11T09:00:00.000Z", actor: "Gulf Retail Admin", note: null }, { action: "verification_started", at: "2026-07-11T09:15:00.000Z", actor: "Khalid Al-Mutairi", note: null }, { action: "verified", at: "2026-07-14T12:00:00.000Z", actor: "Khalid Al-Mutairi", note: null }, { action: "activated", at: "2026-07-14T12:30:00.000Z", actor: "Khalid Al-Mutairi", note: null }, { action: "suspended", at: "2026-09-20T11:00:00.000Z", actor: "Khalid Al-Mutairi", note: "Tenant requested temporary suspension." }] },
  { id: "SID-00007", tenantId: "TEN-00018", channel: "sms", identityType: "sms_sender_id", identityValue: "RIYADHMADE", displayName: "Riyadh Manufacturing", countryMarket: "Saudi Arabia", providerReference: "SMS-RM-11", verificationStatus: "rejected", operationalStatus: "inactive", createdAt: "2026-09-02T09:00:00.000Z", createdBy: "Riyadh Manufacturing Admin", updatedAt: "2026-09-05T15:00:00.000Z", submittedAt: "2026-09-02T10:00:00.000Z", verificationStartedAt: "2026-09-02T10:30:00.000Z", verifiedAt: null, rejectedAt: "2026-09-05T15:00:00.000Z", rejectionReason: "Sender name does not match the registered business name.", activatedAt: null, suspendedAt: null, suspensionReason: null, history: [{ action: "created", at: "2026-09-02T09:00:00.000Z", actor: "Riyadh Manufacturing Admin", note: null }, { action: "submitted", at: "2026-09-02T10:00:00.000Z", actor: "Riyadh Manufacturing Admin", note: null }, { action: "verification_started", at: "2026-09-02T10:30:00.000Z", actor: "Khalid Al-Mutairi", note: null }, { action: "rejected", at: "2026-09-05T15:00:00.000Z", actor: "Khalid Al-Mutairi", note: "Sender name does not match the registered business name." }] },
];

export const PLATFORM_CLIENTS: PlatformApiClient[] = TENANTS.flatMap((t, i) =>
  ["prod", "uat"].slice(0, i % 3 === 0 ? 2 : 1).map((env, j) => ({
    id: `CLT-${String(1000 + i * 7 + j).padStart(5, "0")}`,
    tenantId: t.id,
    clientId: `dc-${t.id.toLowerCase()}-${env}`,
    tenantName: t.name,
    applicationName: env === "prod" ? "Core integration" : "UAT integration",
    status: t.status === "suspended" ? ("revoked" as const) : i === 6 && j === 0 ? ("expired" as const) : ("active" as const),
    rateLimit: t.subscription.planId === "PLN-ENTERPRISE" ? 200 : t.subscription.planId === "PLN-BUSINESS" ? 80 : 20,
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
