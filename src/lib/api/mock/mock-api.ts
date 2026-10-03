import type { DolfConnectApi } from "../client";
import type { ListParams, MessageStatus, Paginated } from "../types";
import { BULK_JOBS, CHANNELS, CONFIG, PLANS, PLATFORM_CLIENTS, ROUTING, SETTINGS, USERS, WEBHOOKS } from "./mock-data-ext";
import { APPLICATIONS, AUDIT, BASE_TIME, CREDENTIALS, MESSAGES, PROVIDERS, TEMPLATES, TENANTS, TREND } from "./mock-data";

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function paginate<T>(rows: T[], p: ListParams): Paginated<T> {
  const page = p.page ?? 1;
  const pageSize = p.pageSize ?? 20;
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}
const has = (q: string | undefined, ...fields: (string | null)[]) =>
  !q || fields.some((f) => f?.toLowerCase().includes(q.toLowerCase()));

export function createMockApi(): DolfConnectApi {
  const credentials = CREDENTIALS.map((c) => ({ ...c }));
  let seq = 4813;
  const bulkJobs = BULK_JOBS.map((j) => ({ ...j }));
  const webhooks = WEBHOOKS.map((w) => ({ ...w }));
  const users = USERS.map((u) => ({ ...u }));
  const channels = CHANNELS.map((c) => ({ ...c }));
  let settings = { ...SETTINGS };
  let bulkSeq = 74;

  return {
    async getDashboard() {
      await delay();
      const sum = (k: "delivered" | "failed" | "pending") => TREND.reduce((a, d) => a + d[k], 0);
      const delivered = sum("delivered");
      const failed = sum("failed");
      const pending = sum("pending");
      const total = delivered + failed + pending;
      return {
        kpis: { total, delivered, failed, pending, deliveryRate: (delivered / total) * 100, totalDeltaPct: 6.4 },
        trend: TREND,
        channels: [
          { channel: "sms", count: Math.round(total * 0.54) },
          { channel: "whatsapp", count: Math.round(total * 0.29) },
          { channel: "email", count: Math.round(total * 0.17) },
        ],
        quota: { used: 410_120, limit: 500_000 },
      };
    },
    async listMessages(p) {
      await delay();
      const rows = MESSAGES.filter(
        (m) =>
          (!p.channel || p.channel === "all" || m.channel === p.channel) &&
          (!p.status || p.status === "all" || m.status === p.status) &&
          has(p.search, m.id, m.recipient, m.templateName, m.applicationName),
      );
      return paginate(rows, p);
    },
    async getMessage(id) {
      await delay(150);
      return MESSAGES.find((m) => m.id === id) ?? null;
    },
    async sendMessage() {
      await delay(700);
      return { id: `MSG-20261001-${String(seq++).padStart(6, "0")}`, status: "accepted" };
    },
    async listTemplates(p) {
      await delay();
      const rows = TEMPLATES.filter(
        (t) =>
          (!p.channel || p.channel === "all" || t.channel === p.channel) &&
          (!p.status || p.status === "all" || t.status === p.status) &&
          has(p.search, t.name, t.category),
      );
      return paginate(rows, { ...p, pageSize: p.pageSize ?? 50 });
    },
    async listApplications() {
      await delay();
      return APPLICATIONS;
    },
    async listCredentials() {
      await delay();
      return credentials.map((c) => ({ ...c }));
    },
    async revokeCredential(id) {
      await delay(400);
      const c = credentials.find((x) => x.id === id);
      if (c) c.status = "revoked";
    },
    async listAuditEvents(p) {
      await delay();
      const rows = AUDIT.filter(
        (a) => (!p.status || p.status === "all" || a.result === p.status) && has(p.search, a.actor, a.action, a.resource),
      );
      return paginate(rows, p);
    },
    async getUsage() {
      await delay();
      return {
        plan: "Enterprise",
        periodStart: new Date(Date.UTC(2026, 9, 1)).toISOString(),
        periodEnd: new Date(Date.UTC(2026, 9, 31)).toISOString(),
        channels: [
          { channel: "sms", used: 221_460, limit: 260_000 },
          { channel: "whatsapp", used: 118_930, limit: 150_000 },
          { channel: "email", used: 69_730, limit: 90_000 },
        ],
      };
    },
    async listTenants(p) {
      await delay();
      const rows = TENANTS.filter(
        (t) => (!p.status || p.status === "all" || t.status === p.status) && has(p.search, t.name, t.id),
      );
      return paginate(rows, p);
    },
    async listProviders() {
      await delay();
      void BASE_TIME;
      return PROVIDERS;
    },
    async listBulkJobs() {
      await delay();
      return [...bulkJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async createBulkJob(input) {
      await delay(800);
      const app = APPLICATIONS.find((a) => a.id === input.applicationId);
      const tpl = TEMPLATES.find((t) => t.id === input.templateId);
      const job = {
        id: `BLK-20261003-${String(bulkSeq++).padStart(5, "0")}`, name: input.name, channel: input.channel,
        applicationName: app?.name ?? "", templateName: tpl?.name ?? null, status: "queued" as const,
        total: input.recipients, delivered: 0, failed: 0, createdAt: new Date().toISOString(), createdBy: "You",
      };
      bulkJobs.push(job);
      return job;
    },
    async listWebhooks() {
      await delay();
      return webhooks.map((w) => ({ ...w }));
    },
    async createWebhook(input) {
      await delay(500);
      const w = { ...input, id: `WHK-00${31 + webhooks.length}`, status: "active" as const, lastDeliveryAt: null, successRate: 100 };
      webhooks.push(w);
      return w;
    },
    async testWebhook() {
      await delay(600);
    },
    async listUsers() {
      await delay();
      return users.map((u) => ({ ...u }));
    },
    async inviteUser(input) {
      await delay(500);
      const u = { ...input, id: `usr-0${170 + users.length}`, status: "invited" as const, mfa: false, lastLoginAt: null };
      users.push(u);
      return u;
    },
    async getSettings() {
      await delay();
      return { ...settings, quotaAlerts: [...settings.quotaAlerts] };
    },
    async updateSettings(input) {
      await delay(500);
      settings = { ...input };
      return settings;
    },
    async getReport() {
      await delay();
      const byStatus = new Map<MessageStatus, number>();
      const byApp = new Map<string, { count: number; failed: number }>();
      for (const m of MESSAGES) {
        byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
        const a = byApp.get(m.applicationName) ?? { count: 0, failed: 0 };
        a.count++;
        if (m.status === "failed" || m.status === "rejected") a.failed++;
        byApp.set(m.applicationName, a);
      }
      return {
        byStatus: [...byStatus].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
        byApplication: [...byApp].map(([applicationName, v]) => ({ applicationName, ...v })).sort((a, b) => b.count - a.count),
        sampleSize: MESSAGES.length,
      };
    },
    async listPlans() {
      await delay();
      return PLANS;
    },
    async listChannels() {
      await delay();
      return channels.map((c) => ({ ...c }));
    },
    async setChannelEnabled(channel, enabled) {
      await delay(400);
      const c = channels.find((x) => x.channel === channel);
      if (c) c.enabled = enabled;
    },
    async listRoutingRules() {
      await delay();
      return [...ROUTING].sort((a, b) => a.channel.localeCompare(b.channel) || a.priority - b.priority);
    },
    async listPlatformClients(p) {
      await delay();
      const rows = PLATFORM_CLIENTS.filter(
        (c) => (!p.status || p.status === "all" || c.status === p.status) && has(p.search, c.clientId, c.tenantName),
      );
      return paginate(rows, p);
    },
    async listConfig() {
      await delay();
      return CONFIG;
    },
  };
}
