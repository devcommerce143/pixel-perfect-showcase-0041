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
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];
const int = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pad = (n: number, w: number) => String(n).padStart(w, "0");

export const BASE_TIME = Date.UTC(2026, 9, 1, 13, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000;
const DAY = 86_400_000;

export const APPLICATIONS: Application[] = [
  { id: "APP-00182", name: "Dolf LMS", environment: "production", status: "active", channels: ["sms", "email"], credentialCount: 2, createdAt: iso(BASE_TIME - 210 * DAY), lastActivityAt: iso(BASE_TIME - 2 * MIN) },
  { id: "APP-00187", name: "Dolf CRM", environment: "production", status: "active", channels: ["sms", "whatsapp", "email"], credentialCount: 1, createdAt: iso(BASE_TIME - 180 * DAY), lastActivityAt: iso(BASE_TIME - 6 * MIN) },
  { id: "APP-00203", name: "Customer Mobile App", environment: "production", status: "active", channels: ["sms", "whatsapp"], credentialCount: 2, createdAt: iso(BASE_TIME - 96 * DAY), lastActivityAt: iso(BASE_TIME - 1 * MIN) },
  { id: "APP-00211", name: "Customer Portal", environment: "production", status: "active", channels: ["email", "sms"], credentialCount: 1, createdAt: iso(BASE_TIME - 64 * DAY), lastActivityAt: iso(BASE_TIME - 24 * MIN) },
  { id: "APP-00219", name: "Customer Portal (UAT)", environment: "sandbox", status: "active", channels: ["email", "sms", "whatsapp"], credentialCount: 1, createdAt: iso(BASE_TIME - 40 * DAY), lastActivityAt: iso(BASE_TIME - 3 * DAY) },
  { id: "APP-00224", name: "Branch Kiosk Integration", environment: "production", status: "disabled", channels: ["sms"], credentialCount: 0, createdAt: iso(BASE_TIME - 300 * DAY), lastActivityAt: iso(BASE_TIME - 45 * DAY) },
];

export const TEMPLATES: Template[] = [
  { id: "TPL-0101", name: "otp_login_en", channel: "sms", category: "Authentication", language: "en", status: "approved", version: 3, updatedAt: iso(BASE_TIME - 12 * DAY), body: "Your Al Noor verification code is {{code}}. It expires in 5 minutes. Do not share it." },
  { id: "TPL-0102", name: "otp_login_ar", channel: "sms", category: "Authentication", language: "ar", status: "approved", version: 2, updatedAt: iso(BASE_TIME - 1 * DAY), body: "رمز التحقق الخاص بك هو {{code}}. صالح لمدة 5 دقائق. لا تشاركه مع أحد." },
  { id: "TPL-0110", name: "payment_confirmation", channel: "whatsapp", category: "Transactional", language: "en", status: "approved", version: 4, updatedAt: iso(BASE_TIME - 20 * DAY), body: "Payment of SAR {{amount}} to {{merchant}} was completed on {{date}}. Ref {{reference}}." },
  { id: "TPL-0111", name: "payment_confirmation_ar", channel: "whatsapp", category: "Transactional", language: "ar", status: "pending", version: 1, updatedAt: iso(BASE_TIME - 2 * DAY), body: "تم سداد مبلغ {{amount}} ريال إلى {{merchant}} بتاريخ {{date}}. المرجع {{reference}}." },
  { id: "TPL-0120", name: "statement_ready", channel: "email", category: "Notification", language: "en", status: "approved", version: 6, updatedAt: iso(BASE_TIME - 33 * DAY), body: "Dear {{name}}, your monthly statement for {{month}} is now available in the customer portal." },
  { id: "TPL-0121", name: "course_enrolment", channel: "email", category: "Notification", language: "en", status: "approved", version: 2, updatedAt: iso(BASE_TIME - 8 * DAY), body: "You have been enrolled in {{course}}. Sessions begin on {{start_date}}." },
  { id: "TPL-0130", name: "appointment_reminder", channel: "whatsapp", category: "Notification", language: "ar", status: "rejected", version: 1, updatedAt: iso(BASE_TIME - 5 * DAY), body: "تذكير بموعدك في فرع {{branch}} يوم {{date}} الساعة {{time}}." },
  { id: "TPL-0140", name: "card_dispatch", channel: "sms", category: "Transactional", language: "en", status: "approved", version: 1, updatedAt: iso(BASE_TIME - 50 * DAY), body: "Your new card ending {{last4}} has been dispatched and will arrive within 3 business days." },
  { id: "TPL-0150", name: "ramadan_offer_2027", channel: "email", category: "Marketing", language: "ar", status: "draft", version: 1, updatedAt: iso(BASE_TIME - 3 * 60 * MIN), body: "عروض رمضان الحصرية لعملاء النور. اكتشف المزيد عبر بوابة العملاء." },
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

export const MESSAGES: Message[] = Array.from({ length: 240 }, (_, i) => {
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
    applicationId: app.id,
    applicationName: app.name,
    templateName: template?.name ?? null,
    status,
    createdAt: iso(created),
    updatedAt: events[events.length - 1].at,
    tenantName: "Al Noor Financial Services",
    correlationId: `cor_${Math.floor(rng() * 1e12).toString(36)}${Math.floor(rng() * 1e8).toString(36)}`,
    segments: channel === "sms" ? int(1, 3) : 1,
    source,
    bulkJobId: source === "bulk" ? `BLK-${datePart}-${pad(72 - (i % 5), 5)}` : null,
    errorCode: fail?.[0] ?? null,
    errorMessage: fail?.[1] ?? null,
    preview: template?.body ?? "Your request has been received and is being processed. Ref AN-" + pad(int(10000, 99999), 5),
    events,
  };
});

export const CREDENTIALS: ApiCredential[] = [
  { id: "CRD-00412", applicationName: "Dolf LMS", clientId: "dc-app-00182-prod", keyPrefix: "dck_live_7Hq2", status: "active", scopes: ["messages:send", "messages:read"], createdAt: iso(BASE_TIME - 120 * DAY), expiresAt: iso(BASE_TIME + 245 * DAY), lastUsedAt: iso(BASE_TIME - 2 * MIN) },
  { id: "CRD-00413", applicationName: "Dolf LMS", clientId: "dc-app-00182-ops", keyPrefix: "dck_live_Pz81", status: "active", scopes: ["messages:read"], createdAt: iso(BASE_TIME - 60 * DAY), expiresAt: iso(BASE_TIME + 305 * DAY), lastUsedAt: iso(BASE_TIME - 3 * 60 * MIN) },
  { id: "CRD-00420", applicationName: "Dolf CRM", clientId: "dc-app-00187-prod", keyPrefix: "dck_live_bR4k", status: "active", scopes: ["messages:send", "messages:read", "templates:read"], createdAt: iso(BASE_TIME - 150 * DAY), expiresAt: iso(BASE_TIME + 215 * DAY), lastUsedAt: iso(BASE_TIME - 6 * MIN) },
  { id: "CRD-00431", applicationName: "Customer Mobile App", clientId: "dc-app-00203-prod", keyPrefix: "dck_live_Lm9s", status: "active", scopes: ["messages:send"], createdAt: iso(BASE_TIME - 90 * DAY), expiresAt: iso(BASE_TIME + 18 * DAY), lastUsedAt: iso(BASE_TIME - 1 * MIN) },
  { id: "CRD-00432", applicationName: "Customer Mobile App", clientId: "dc-app-00203-v1", keyPrefix: "dck_live_Qa0e", status: "revoked", scopes: ["messages:send"], createdAt: iso(BASE_TIME - 200 * DAY), expiresAt: iso(BASE_TIME + 165 * DAY), lastUsedAt: iso(BASE_TIME - 92 * DAY) },
  { id: "CRD-00440", applicationName: "Customer Portal", clientId: "dc-app-00211-prod", keyPrefix: "dck_live_Wn3t", status: "active", scopes: ["messages:send", "messages:read"], createdAt: iso(BASE_TIME - 64 * DAY), expiresAt: iso(BASE_TIME + 301 * DAY), lastUsedAt: iso(BASE_TIME - 24 * MIN) },
  { id: "CRD-00447", applicationName: "Customer Portal (UAT)", clientId: "dc-app-00219-sbx", keyPrefix: "dck_test_Ux5c", status: "active", scopes: ["messages:send", "messages:read", "templates:read"], createdAt: iso(BASE_TIME - 40 * DAY), expiresAt: iso(BASE_TIME + 50 * DAY), lastUsedAt: iso(BASE_TIME - 3 * DAY) },
  { id: "CRD-00398", applicationName: "Branch Kiosk Integration", clientId: "dc-app-00224-prod", keyPrefix: "dck_live_Ke2j", status: "expired", scopes: ["messages:send"], createdAt: iso(BASE_TIME - 400 * DAY), expiresAt: iso(BASE_TIME - 35 * DAY), lastUsedAt: null },
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
  ["Qassim Agricultural Co-op", "Starter", "active", 4, 9_870, 33],
  ["Hijaz Property Management", "Business", "suspended", 11, 0, 100],
  ["Al Khobar Auto Services", "Starter", "active", 5, 21_430, 72],
  ["Madinah Hospitality Group", "Business", "active", 14, 73_860, 48],
].map(([name, plan, status, users, vol, q], i) => ({
  id: `TEN-${pad(12 + i * 3, 5)}`,
  name: name as string,
  plan: plan as string,
  status: status as Tenant["status"],
  users: users as number,
  messages30d: vol as number,
  quotaPct: q as number,
  region: i % 3 === 2 ? "KSA-West" : "KSA-Central",
  createdAt: iso(BASE_TIME - (400 - i * 31) * DAY),
}));

export const PROVIDERS: Provider[] = [
  { id: "PRV-SMS-01", name: "SMS Gateway A", channel: "sms", type: "Primary", status: "healthy", latencyMs: 820, successRate: 98.7, priority: 1, region: "KSA", checkedAt: iso(BASE_TIME - 1 * MIN) },
  { id: "PRV-SMS-02", name: "SMS Gateway B", channel: "sms", type: "Failover", status: "degraded", latencyMs: 2140, successRate: 94.2, priority: 2, region: "KSA", checkedAt: iso(BASE_TIME - 1 * MIN) },
  { id: "PRV-WA-01", name: "WhatsApp Business Platform", channel: "whatsapp", type: "Primary", status: "healthy", latencyMs: 610, successRate: 99.1, priority: 1, region: "Global", checkedAt: iso(BASE_TIME - 2 * MIN) },
  { id: "PRV-EM-01", name: "Email Relay A", channel: "email", type: "Primary", status: "healthy", latencyMs: 340, successRate: 99.4, priority: 1, region: "EU", checkedAt: iso(BASE_TIME - 1 * MIN) },
  { id: "PRV-EM-02", name: "Email Relay B", channel: "email", type: "Failover", status: "unavailable", latencyMs: 0, successRate: 0, priority: 2, region: "ME", checkedAt: iso(BASE_TIME - 4 * MIN) },
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
