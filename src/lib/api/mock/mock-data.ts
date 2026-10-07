import type {
  ApiCredential,
  Application,
  AuditEvent,
  Channel,
  Message,
  MessageEvent,
  MessageStatus,
  Provider,
  Template,
  Tenant,
} from "../types";

/** Deterministic mock dataset (seeded) so SSR and client render identically. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261001);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pad = (n: number, w: number) => String(n).padStart(w, "0");

export const BASE_TIME = Date.UTC(2026, 9, 1, 13, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000;
const DAY = 86_400_000;

export const APPLICATIONS: Application[] = [
  { id: "APP-00182", tenantId: "TEN-00012", name: "Dolf LMS", environment: "production", status: "active", channels: ["sms", "email"], scopes: ["messages:send", "messages:read"], credentialCount: 2, createdAt: iso(BASE_TIME - 210 * DAY), lastActivityAt: iso(BASE_TIME - 2 * MIN) },
  { id: "APP-00187", tenantId: "TEN-00012", name: "Dolf CRM", environment: "production", status: "active", channels: ["sms", "whatsapp", "email"], scopes: ["messages:send", "messages:read", "templates:read"], credentialCount: 1, createdAt: iso(BASE_TIME - 180 * DAY), lastActivityAt: iso(BASE_TIME - 6 * MIN) },
  { id: "APP-00203", tenantId: "TEN-00012", name: "Customer Mobile App", environment: "production", status: "active", channels: ["sms", "whatsapp"], scopes: ["messages:send"], credentialCount: 2, createdAt: iso(BASE_TIME - 96 * DAY), lastActivityAt: iso(BASE_TIME - 1 * MIN) },
  { id: "APP-00211", tenantId: "TEN-00012", name: "Customer Portal", environment: "production", status: "active", channels: ["email", "sms"], scopes: ["messages:send", "messages:read"], credentialCount: 1, createdAt: iso(BASE_TIME - 64 * DAY), lastActivityAt: iso(BASE_TIME - 24 * MIN) },
  { id: "APP-00219", tenantId: "TEN-00012", name: "Customer Portal (UAT)", environment: "sandbox", status: "active", channels: ["email", "sms", "whatsapp"], scopes: ["messages:send", "messages:read", "templates:read"], credentialCount: 1, createdAt: iso(BASE_TIME - 40 * DAY), lastActivityAt: iso(BASE_TIME - 3 * DAY) },
  { id: "APP-00224", tenantId: "TEN-00012", name: "Branch Kiosk Integration", environment: "production", status: "disabled", channels: ["sms"], scopes: ["messages:send"], credentialCount: 0, createdAt: iso(BASE_TIME - 300 * DAY), lastActivityAt: iso(BASE_TIME - 45 * DAY) },
];

export const TEMPLATES: Template[] = [
  { id: "TPL-0101", tenantId: "TEN-00012", name: "otp_login_en", channel: "sms", category: "Authentication", language: "en", status: "active", subject: null, version: 3, updatedAt: iso(BASE_TIME - 12 * DAY), body: "Your Al Noor verification code is {{code}}. It expires in 5 minutes. Do not share it." },
  { id: "TPL-0102", tenantId: "TEN-00012", name: "otp_login_ar", channel: "sms", category: "Authentication", language: "ar", status: "active", subject: null, version: 2, updatedAt: iso(BASE_TIME - 1 * DAY), body: "رمز التحقق الخاص بك هو {{code}}. صالح لمدة 5 دقائق. لا تشاركه مع أحد." },
  { id: "TPL-0110", tenantId: "TEN-00012", name: "payment_confirmation", channel: "whatsapp", category: "Transactional", language: "en", status: "approved", subject: null, version: 4, updatedAt: iso(BASE_TIME - 20 * DAY), body: "Payment of SAR {{amount}} to {{merchant}} was completed on {{date}}. Ref {{reference}}.", approval: { provider: "Meta Cloud API", status: "approved", submittedAt: "2026-08-10T10:00:00.000Z", reviewedAt: "2026-08-11T12:00:00.000Z", rejectionReason: null }, versionHistory: [{ version: 3, subject: null, body: "Payment to {{merchant}} was completed. Ref {{reference}}.", status: "approved", updatedAt: "2026-07-20T12:00:00.000Z", updatedBy: "Noura Al-Qahtani" }] },
  { id: "TPL-0111", tenantId: "TEN-00012", name: "payment_confirmation_ar", channel: "whatsapp", category: "Transactional", language: "ar", status: "pending_approval", subject: null, version: 1, updatedAt: iso(BASE_TIME - 2 * DAY), body: "تم سداد مبلغ {{amount}} ريال إلى {{merchant}} بتاريخ {{date}}. المرجع {{reference}}.", approval: { provider: "Meta Cloud API", status: "pending", submittedAt: iso(BASE_TIME - 2 * DAY), reviewedAt: null, rejectionReason: null } },
  { id: "TPL-0120", tenantId: "TEN-00012", name: "statement_ready", channel: "email", category: "Notification", language: "en", status: "active", subject: "Your monthly statement is ready", version: 6, updatedAt: iso(BASE_TIME - 33 * DAY), body: "Dear {{name}}, your monthly statement for {{month}} is now available in the customer portal." },
  { id: "TPL-0121", tenantId: "TEN-00012", name: "course_enrolment", channel: "email", category: "Notification", language: "en", status: "active", subject: "Course enrolment confirmed", version: 2, updatedAt: iso(BASE_TIME - 8 * DAY), body: "You have been enrolled in {{course}}. Sessions begin on {{start_date}}." },
  { id: "TPL-0130", tenantId: "TEN-00012", name: "appointment_reminder", channel: "whatsapp", category: "Notification", language: "ar", status: "rejected", subject: null, version: 1, updatedAt: iso(BASE_TIME - 5 * DAY), body: "تذكير بموعدك في فرع {{branch}} يوم {{date}} الساعة {{time}}.", approval: { provider: "Meta Cloud API", status: "rejected", submittedAt: "2026-09-01T10:00:00.000Z", reviewedAt: "2026-09-05T15:00:00.000Z", rejectionReason: "Template content did not meet provider policy." } },
  { id: "TPL-0140", tenantId: "TEN-00012", name: "card_dispatch", channel: "sms", category: "Transactional", language: "en", status: "active", subject: null, version: 1, updatedAt: iso(BASE_TIME - 50 * DAY), body: "Your new card ending {{last4}} has been dispatched and will arrive within 3 business days." },
  { id: "TPL-0150", tenantId: "TEN-00012", name: "ramadan_offer_2027", channel: "email", category: "Marketing", language: "ar", status: "draft", subject: "عروض رمضان", version: 1, updatedAt: iso(BASE_TIME - 3 * 60 * MIN), body: "عروض رمضان الحصرية لعملاء النور. اكتشف المزيد عبر بوابة العملاء." },
  { id: "TPL-0151", tenantId: "TEN-00015", name: "gulf_order_update", channel: "sms", category: "Transactional", language: "en", status: "active", subject: null, version: 2, updatedAt: iso(BASE_TIME - 6 * DAY), body: "Your order {{orderId}} has shipped." },
];

const STATUS_WEIGHTS: [MessageStatus, number][] = [
  ["delivered", 62], ["read", 8], ["sent", 10], ["processing", 5], ["queued", 4], ["failed", 8], ["rejected", 3],
];
function weightedStatus(): MessageStatus {
  let r = rng() * 100;
  for (const [s, w] of STATUS_WEIGHTS) {
    if ((r -= w) < 0) return s;
  }
  return "delivered";
}

const FAILURES: Record<Channel, [string, string][]> = {
  sms: [["DC-4102", "Recipient handset unreachable after retry window"], ["DC-4110", "Number not in service"]],
  whatsapp: [["DC-4201", "Recipient is not a WhatsApp user"], ["DC-4207", "Template parameters do not match approved template"]],
  email: [["DC-4301", "Mailbox does not exist (hard bounce)"], ["DC-4305", "Recipient mailbox full"]],
};
const FIRST = ["n.alqahtani", "f.alharbi", "s.alotaibi", "m.alghamdi", "a.alzahrani", "h.alshehri", "r.aldosari", "o.almalki"];

function renderSeededTemplate(body: string, index: number) {
  const values: Record<string, string> = {
    code: String(481902 + (index % 87000)),
    last4: pad(4821 + (index % 170), 4),
    amount: `${(250 + (index % 950) * 1.25).toFixed(2)} SAR`,
    merchant: ["Al Noor Markets", "Riyadh Central", "Dolf Services"][index % 3]!,
    date: `0${(index % 8) + 1} Oct 2026`,
    reference: `AN-${pad(928103 + index, 6)}`,
    name: ["Noura", "Faisal", "Reem"][index % 3]!,
    month: "September 2026",
    course: "Digital Banking Essentials",
    start_date: "12 October 2026",
  };
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? "Verified customer");
}

function recipient(ch: Channel) {
  if (ch === "email") return `${pick(FIRST)}@${pick(["alnoor-fs", "mail", "corp"])}.example`;
  return `+966 5${int(0, 9)} ••• ${pad(int(0, 9999), 4)}`;
}

function buildEvents(status: MessageStatus, created: number): MessageEvent[] {
  const ev: MessageEvent[] = [{ status: "accepted", at: iso(created) }];
  const t = (s: number) => iso(created + s * 1000);
  if (status === "queued") return ev.concat({ status: "queued", at: t(1) });
  ev.push({ status: "queued", at: t(1) }, { status: "processing", at: t(2) });
  if (status === "processing") return ev;
  if (status === "rejected") return ev.concat({ status: "rejected", at: t(3) });
  ev.push({ status: "sent", at: t(3) });
  if (status === "sent") return ev;
  if (status === "failed") return ev.concat({ status: "failed", at: t(int(20, 400)) });
  ev.push({ status: "delivered", at: t(int(4, 30)) });
  if (status === "read") ev.push({ status: "read", at: t(int(60, 3000)) });
  return ev;
}

const RAW_MESSAGES: Message[] = Array.from({ length: 240 }, (_, i) => {
  const created = BASE_TIME - i * int(4, 14) * MIN - int(0, 59) * 1000;
  const app = pick(APPLICATIONS.filter((a) => a.status === "active"));
  const channel = pick(app.channels);
  const tpls = TEMPLATES.filter((tp) => tp.channel === channel && tp.status === "approved");
  const template = channel === "whatsapp" || rng() > 0.25 ? pick(tpls) : null;
  const status = weightedStatus();
  const fail = status === "failed" || status === "rejected" ? pick(FAILURES[channel]) : null;
  const events = buildEvents(status, created);
  const d = new Date(created);
  const datePart = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`;
  const source = rng() > 0.85 ? "bulk" : rng() > 0.2 ? "api" : "portal";
  return {
    id: `MSG-${datePart}-${pad(4812 - i, 6)}`,
    channel,
    recipient: recipient(channel),
    tenantId: app.tenantId,
    applicationId: app.id,
    applicationName: app.name,
    templateName: template?.name ?? null,
    status,
    createdAt: iso(created),
    updatedAt: events[events.length - 1]!.at,
    tenantName: "Al Noor Financial Services",
    correlationId: `cor_${Math.floor(rng() * 1e12).toString(36)}${Math.floor(rng() * 1e8).toString(36)}`,
    segments: channel === "sms" ? int(1, 3) : 1,
    source,
    bulkJobId: source === "bulk" ? `BLK-${datePart}-${pad(72 - (i % 5), 5)}` : null,
    errorCode: fail?.[0] ?? null,
    errorMessage: fail?.[1] ?? null,
    preview: template ? renderSeededTemplate(template.body, i) : "Your request has been received and is being processed. Ref AN-" + pad(int(10000, 99999), 5),
    events,
  };
});

export const MESSAGES: Message[] = [...RAW_MESSAGES].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const CREDENTIALS: ApiCredential[] = [
  { id: "CRD-00412", tenantId: "TEN-00012", applicationId: "APP-00182", applicationName: "Dolf LMS", clientId: "dc_live_00182", keyPrefix: "dc_live_00182", environment: "production", status: "active", scopes: ["messages:send", "messages:read"], createdAt: iso(BASE_TIME - 120 * DAY), expiresAt: iso(BASE_TIME + 245 * DAY), lastUsedAt: iso(BASE_TIME - 2 * MIN), rateLimit: 60, createdBy: "system" },
  { id: "CRD-00413", tenantId: "TEN-00012", applicationId: "APP-00182", applicationName: "Dolf LMS", clientId: "dc_live_00182_ops", keyPrefix: "dc_live_00182", environment: "production", status: "active", scopes: ["messages:read"], createdAt: iso(BASE_TIME - 60 * DAY), expiresAt: iso(BASE_TIME + 305 * DAY), lastUsedAt: iso(BASE_TIME - 3 * 60 * MIN), rateLimit: 30, createdBy: "system" },
  { id: "CRD-00420", tenantId: "TEN-00012", applicationId: "APP-00187", applicationName: "Dolf CRM", clientId: "dc_live_00187", keyPrefix: "dc_live_00187", environment: "production", status: "active", scopes: ["messages:send", "messages:read", "templates:read"], createdAt: iso(BASE_TIME - 150 * DAY), expiresAt: iso(BASE_TIME + 215 * DAY), lastUsedAt: iso(BASE_TIME - 6 * MIN), rateLimit: 90, createdBy: "system" },
  { id: "CRD-00431", tenantId: "TEN-00012", applicationId: "APP-00203", applicationName: "Customer Mobile App", clientId: "dc_live_00203", keyPrefix: "dc_live_00203", environment: "production", status: "active", scopes: ["messages:send"], createdAt: iso(BASE_TIME - 90 * DAY), expiresAt: iso(BASE_TIME + 18 * DAY), lastUsedAt: iso(BASE_TIME - 1 * MIN), rateLimit: 40, createdBy: "system" },
  { id: "CRD-00432", tenantId: "TEN-00012", applicationId: "APP-00203", applicationName: "Customer Mobile App", clientId: "dc_live_00203_v1", keyPrefix: "dc_live_00203", environment: "production", status: "revoked", scopes: ["messages:send"], createdAt: iso(BASE_TIME - 200 * DAY), expiresAt: iso(BASE_TIME + 165 * DAY), lastUsedAt: iso(BASE_TIME - 92 * DAY), revokedAt: iso(BASE_TIME - 2 * DAY), revokedBy: "system", rateLimit: 40, createdBy: "system" },
  { id: "CRD-00440", tenantId: "TEN-00012", applicationId: "APP-00211", applicationName: "Customer Portal", clientId: "dc_live_00211", keyPrefix: "dc_live_00211", environment: "production", status: "active", scopes: ["messages:send", "messages:read"], createdAt: iso(BASE_TIME - 64 * DAY), expiresAt: iso(BASE_TIME + 301 * DAY), lastUsedAt: iso(BASE_TIME - 24 * MIN), rateLimit: 35, createdBy: "system" },
  { id: "CRD-00447", tenantId: "TEN-00012", applicationId: "APP-00219", applicationName: "Customer Portal (UAT)", clientId: "dc_test_00219", keyPrefix: "dc_test_00219", environment: "sandbox", status: "active", scopes: ["messages:send", "messages:read", "templates:read"], createdAt: iso(BASE_TIME - 40 * DAY), expiresAt: iso(BASE_TIME + 50 * DAY), lastUsedAt: iso(BASE_TIME - 3 * DAY), rateLimit: 25, createdBy: "system" },
  { id: "CRD-00398", tenantId: "TEN-00012", applicationId: "APP-00224", applicationName: "Branch Kiosk Integration", clientId: "dc_live_00224", keyPrefix: "dc_live_00224", environment: "production", status: "expired", scopes: ["messages:send"], createdAt: iso(BASE_TIME - 400 * DAY), expiresAt: iso(BASE_TIME - 35 * DAY), lastUsedAt: null, rateLimit: 20, createdBy: "system" },
];

const ACTIONS: [string, string, AuditEvent["actorType"]][] = [
  ["auth.login", "Session", "user"],
  ["template.submit_for_approval", "Template otp_login_ar", "user"],
  ["credential.create", "Credential CRD-00447", "user"],
  ["credential.revoke", "Credential CRD-00432", "user"],
  ["message.send", "Message batch via API", "service"],
  ["application.update", "Application APP-00211", "user"],
  ["user.role_change", "User usr-0163", "user"],
  ["bulk_job.create", "Bulk job BLK-20261001-00072", "user"],
  ["auth.login_failed", "Session", "user"],
  ["webhook.update", "Webhook endpoint WHK-0021", "user"],
];
const ACTORS = ["Noura Al-Qahtani", "Faisal Al-Harbi", "Reem Al-Dosari", "Saad Al-Otaibi"];

export const AUDIT: AuditEvent[] = Array.from({ length: 96 }, (_, i) => {
  const [action, resource, actorType] = pick(ACTIONS);
  return {
    id: `AUD-${pad(88231 - i, 7)}`,
    at: iso(BASE_TIME - i * int(9, 55) * MIN),
    actor: actorType === "service" ? pick(["dc-app-00182-prod", "dc-app-00203-prod", "dc-app-00187-prod"]) : pick(ACTORS),
    actorType,
    tenantId: "TEN-00012",
    action,
    resource,
    result: action === "auth.login_failed" ? "failure" : rng() > 0.96 ? "failure" : "success",
    ip: `10.${int(10, 40)}.${int(0, 255)}.${int(1, 254)}`,
  };
});

export const TENANTS: Tenant[] = [
  ["Al Noor Financial Services", "Enterprise", "active", 42, 418_920, 82],
  ["Gulf Retail Group", "Enterprise", "active", 37, 612_400, 64],
  ["Riyadh Manufacturing Co.", "Business", "active", 18, 88_310, 41],
  ["Eastern Province Healthcare", "Enterprise", "active", 56, 902_115, 91],
  ["Najd Education Holding", "Business", "active", 23, 154_002, 57],
  ["Red Sea Logistics", "Business", "trial", 6, 4_120, 12],
  ["Qassim Agricultural Co-op", "Standard", "active", 4, 9_870, 33],
  ["Hijaz Property Management", "Business", "suspended", 11, 0, 100],
  ["Al Khobar Auto Services", "Standard", "active", 5, 21_430, 72],
  ["Madinah Hospitality Group", "Business", "active", 14, 73_860, 48],
].map(([name, planName, status, users, vol, q], i) => {
  const id = `TEN-${pad(12 + i * 3, 5)}`;
  const createdAt = iso(BASE_TIME - (400 - i * 31) * DAY);
  return {
    id,
    name: name as string,
    code: id,
    status: status as Tenant["status"],
    region: i % 3 === 2 ? "KSA-West" : "KSA-Central",
    dataRegion: i % 3 === 2 ? "KSA-West" : "KSA-Central",
    defaultLanguage: "en",
    timezone: "Asia/Riyadh",
    notes: "",
    subscription: {
      id: `SUB-${pad(12 + i * 3, 5)}`,
      planId: planName === "Enterprise" ? "PLN-ENTERPRISE" : planName === "Business" ? "PLN-BUSINESS" : "PLN-STANDARD",
      status: status === "trial" ? "trial" : status === "inactive" ? "cancelled" : "active",
      overrides: null,
      createdAt,
      updatedAt: createdAt,
    },
    primaryAdministratorId: i === 0 ? "usr-0101" : `usr-tenant-${id}`,
    users: users as number,
    applications: 2,
    messages30d: vol as number,
    quotaPct: q as number,
    createdAt,
    updatedAt: createdAt,
  };
});

export const PROVIDERS: Provider[] = [
  { id: "PRV-SMS-01", name: "Taqnyat — Saudi SMS", channel: "sms", adapterId: "taqnyat", environment: "production", dataRegion: "ksaCentral", adapterConfig: { adapterId: "taqnyat", values: { apiBaseUrl: "https://api.taqnyat.sa" } }, status: "healthy", enabled: true, secretConfigured: true, latencyMs: 820, successRate: 98.7, checkedAt: iso(BASE_TIME - 1 * MIN), lastConnectionTest: { outcome: "success", success: true, latencyMs: 820, testedAt: iso(BASE_TIME - 1 * MIN) }, health: { reason: "operational", lastSuccessfulCheckAt: iso(BASE_TIME - 2 * MIN), statusSince: null, requests24h: 245820, failures24h: 3194, lastFailureAt: iso(BASE_TIME - 3 * MIN), lastFailureReason: "connection_timeout" } },
  { id: "PRV-SMS-02", name: "Infobip — SMS", channel: "sms", adapterId: "infobip", environment: "production", dataRegion: "ksaWest", adapterConfig: { adapterId: "infobip", values: { apiBaseUrl: "https://api.infobip.com" } }, status: "degraded", enabled: true, secretConfigured: true, latencyMs: 2140, successRate: 94.2, checkedAt: iso(BASE_TIME - 1 * MIN), lastConnectionTest: { outcome: "authentication_failed", success: false, latencyMs: 2140, testedAt: iso(BASE_TIME - 1 * MIN) }, health: { reason: "latency_threshold", lastSuccessfulCheckAt: iso(BASE_TIME - 8 * MIN), statusSince: iso(BASE_TIME - 35 * MIN), requests24h: 168420, failures24h: 9768, lastFailureAt: iso(BASE_TIME - 1 * MIN), lastFailureReason: "authentication_failed" } },
  { id: "PRV-WA-01", name: "Meta Cloud API — WhatsApp", channel: "whatsapp", adapterId: "metaCloudApi", environment: "production", dataRegion: "global", adapterConfig: { adapterId: "metaCloudApi", values: { wabaId: "WABA-104281", phoneNumberId: "PHONE-96650001", webhookUrl: "https://hooks.dolfconnect.example/whatsapp", webhookStatus: "configured" } }, status: "healthy", enabled: true, secretConfigured: true, latencyMs: 610, successRate: 99.1, checkedAt: iso(BASE_TIME - 2 * MIN), lastConnectionTest: { outcome: "success", success: true, latencyMs: 610, testedAt: iso(BASE_TIME - 2 * MIN) }, health: { reason: "operational", lastSuccessfulCheckAt: iso(BASE_TIME - 2 * MIN), statusSince: null, requests24h: 86420, failures24h: 778, lastFailureAt: iso(BASE_TIME - 26 * MIN), lastFailureReason: "connection_timeout" } },
  { id: "PRV-EM-01", name: "AWS SES — Email", channel: "email", adapterId: "awsSes", environment: "production", dataRegion: "europe", adapterConfig: { adapterId: "awsSes", values: { awsRegion: "eu-west-1" } }, status: "healthy", enabled: true, secretConfigured: true, latencyMs: 340, successRate: 99.4, checkedAt: iso(BASE_TIME - 1 * MIN), lastConnectionTest: { outcome: "success", success: true, latencyMs: 340, testedAt: iso(BASE_TIME - 1 * MIN) }, health: { reason: "operational", lastSuccessfulCheckAt: iso(BASE_TIME - 1 * MIN), statusSince: null, requests24h: 112640, failures24h: 676, lastFailureAt: iso(BASE_TIME - 42 * MIN), lastFailureReason: "provider_unavailable" } },
  { id: "PRV-EM-02", name: "SMTP Relay — Email", channel: "email", adapterId: "smtp", environment: "production", dataRegion: "middleEast", adapterConfig: { adapterId: "smtp", values: { host: "smtp.relay.example", port: "587", username: "dolf-connect", secure: true } }, status: "unavailable", enabled: false, secretConfigured: true, latencyMs: 0, successRate: 0, checkedAt: iso(BASE_TIME - 4 * MIN), lastConnectionTest: { outcome: "provider_unavailable", success: false, latencyMs: 0, testedAt: iso(BASE_TIME - 4 * MIN) }, health: { reason: "provider_unavailable", lastSuccessfulCheckAt: iso(BASE_TIME - 6 * 60 * MIN), statusSince: iso(BASE_TIME - 4 * MIN), requests24h: 38410, failures24h: 2840, lastFailureAt: iso(BASE_TIME - 4 * MIN), lastFailureReason: "provider_unavailable" } },
];

export function buildTrend() {
  return Array.from({ length: 14 }, (_, i) => {
    const day = new Date(BASE_TIME - (13 - i) * DAY);
    const weekend = day.getUTCDay() === 5 || day.getUTCDay() === 6;
    const base = weekend ? int(6200, 7800) : int(11800, 14600);
    return {
      date: day.toISOString().slice(0, 10),
      delivered: Math.round(base * 0.9),
      failed: Math.round(base * (0.025 + rng() * 0.03)),
      pending: Math.round(base * 0.04),
    };
  });
}
export const TREND = buildTrend();
