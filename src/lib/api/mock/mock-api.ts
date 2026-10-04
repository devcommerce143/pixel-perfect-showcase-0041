import type { DolfConnectApi } from "../client";
import type { ApiCredential, Application, BulkJob, ListParams, Message, MessageStatus, Paginated, Provider, RoutingRule, Template, Tenant, Webhook, WebhookDelivery } from "../types";
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
  let credentialSeq = 448;
  let seq = 4813;
  const bulkJobs = BULK_JOBS.map((j) => ({ ...j }));
  const webhooks = WEBHOOKS.map((w) => ({ ...w }));
  const users = USERS.map((u) => ({ ...u }));
  const channels = CHANNELS.map((c) => ({ ...c }));
  let settings = { ...SETTINGS };
  let bulkSeq = 74;
  const plans = PLANS.map((plan) => ({ ...plan, entitlements: plan.entitlements.map((e) => ({ ...e })), features: [...plan.features] }));
  let planSeq = 5;
  const tenants = TENANTS.map((tenant) => ({ ...tenant, enabledChannels: [...tenant.enabledChannels], quotas: { ...tenant.quotas } }));
  let tenantSeq = tenants.length + 1;
  const applications = APPLICATIONS.map((application) => ({ ...application, channels: [...application.channels], scopes: [...application.scopes] }));
  let applicationSeq = 225;
  const templates = TEMPLATES.map((template) => ({ ...template }));
  let templateSeq = 151;
  const providers = PROVIDERS.map((provider) => ({ ...provider }));
  let providerSeq = 3;
  const routingRules = ROUTING.map((rule) => ({ ...rule }));
  let routingSeq = routingRules.length + 1;
  const config = CONFIG.map((param) => ({ ...param }));
  const platformClients = PLATFORM_CLIENTS.map((client) => ({ ...client }));
  const messages = MESSAGES.map((message) => ({ ...message, events: [...message.events] }));

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
      const rows = messages.filter(
        (m) =>
          (!p.channel || p.channel === "all" || m.channel === p.channel) &&
          (!p.status || p.status === "all" || m.status === p.status) &&
          has(p.search, m.id, m.recipient, m.templateName, m.applicationName),
      );
      return paginate(rows, p);
    },
    async getMessage(id) {
      await delay(150);
      const message = messages.find((m) => m.id === id);
      return message ? { ...message, events: [...message.events] } : null;
    },
    async sendMessage(input) {
      await delay(700);
      const id = `MSG-20261004-${String(seq++).padStart(6, "0")}`;
      const now = new Date().toISOString();
      const application = applications.find((item) => item.id === input.applicationId);
      const template = templates.find((item) => item.id === input.templateId);
      const message: Message = {
        id,
        channel: input.channel,
        recipient: input.recipient,
        applicationId: input.applicationId,
        applicationName: application?.name ?? "Unknown application",
        templateName: template?.name ?? null,
        status: "queued",
        createdAt: now,
        updatedAt: now,
        tenantName: "Al Noor Financial Services",
        correlationId: `cor_${crypto.randomUUID().replaceAll("-", "")}`,
        segments: input.channel === "sms" ? Math.max(1, Math.ceil(input.body.length / 160)) : 1,
        source: "portal",
        bulkJobId: null,
        errorCode: null,
        errorMessage: null,
        preview: input.body,
        events: [{ status: "accepted", at: now }, { status: "queued", at: now }],
      };
      messages.unshift(message);
      return { id, status: "accepted" };
    },
    async listTemplates(p) {
      await delay();
      const rows = templates.filter(
        (t) =>
          (!p.channel || p.channel === "all" || t.channel === p.channel) &&
          (!p.status || p.status === "all" || t.status === p.status) &&
          has(p.search, t.name, t.category),
      );
      return paginate(rows, { ...p, pageSize: p.pageSize ?? 50 });
    },
    async createTemplate(input) {
      await delay(500);
      if (templates.some((template) => template.name.toLowerCase() === input.name.trim().toLowerCase() && template.channel === input.channel)) {
        throw new Error("Template name already exists for this channel");
      }
      const template: Template = {
        ...input,
        id: `TPL-${String(templateSeq++).padStart(4, "0")}`,
        status: input.channel === "whatsapp" ? "pending" : "draft",
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      templates.unshift(template);
      return { ...template };
    },
    async updateTemplate(id, input) {
      await delay(450);
      const template = templates.find((item) => item.id === id);
      if (!template) throw new Error("Template was not found");
      if (templates.some((item) => item.id !== id && item.channel === input.channel && item.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Template name already exists for this channel");
      Object.assign(template, input, { status: input.channel === "whatsapp" ? "pending" : "draft", version: template.version + 1, updatedAt: new Date().toISOString() });
      return { ...template };
    },
    async listApplications() {
      await delay();
      return applications.map((application) => ({ ...application, channels: [...application.channels], scopes: [...application.scopes] }));
    },
    async createApplication(input) {
      await delay(500);
      if (applications.some((application) => application.name.toLowerCase() === input.name.trim().toLowerCase())) {
        throw new Error("Application name already exists");
      }
      const now = new Date().toISOString();
      const application: Application = {
        ...input,
        id: `APP-${String(applicationSeq++).padStart(5, "0")}`,
        status: "active",
        credentialCount: 0,
        createdAt: now,
        lastActivityAt: now,
      };
      applications.push(application);
      return { ...application, channels: [...application.channels], scopes: [...application.scopes] };
    },
    async updateApplication(id, input) {
      await delay(450);
      const application = applications.find((item) => item.id === id);
      if (!application) throw new Error("Application was not found");
      if (applications.some((item) => item.id !== id && item.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Application name already exists");
      Object.assign(application, input, { channels: [...input.channels], scopes: [...input.scopes] });
      return { ...application, channels: [...application.channels], scopes: [...application.scopes] };
    },
    async setApplicationStatus(id, status) {
      await delay(300);
      const application = applications.find((item) => item.id === id);
      if (application) application.status = status;
    },
    async listCredentials() {
      await delay();
      return credentials.map((c) => ({ ...c, scopes: [...c.scopes] }));
    },
    async createCredential(input) {
      await delay(500);
      const application = applications.find((item) => item.id === input.applicationId);
      if (!application || application.status !== "active") throw new Error("Application is unavailable");
      if (!input.scopes.length || input.scopes.some((scope) => !application.scopes.includes(scope))) {
        throw new Error("Credential scopes exceed application permissions");
      }
      const secret = `dck_live_${crypto.randomUUID().replaceAll("-", "")}`;
      const now = new Date();
      const credential: ApiCredential = {
        id: `CRD-${String(credentialSeq++).padStart(5, "0")}`,
        applicationName: application.name,
        clientId: `dc-${application.id.toLowerCase()}-${credentialSeq}`,
        keyPrefix: secret.slice(0, 12),
        status: "active",
        scopes: [...input.scopes],
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        lastUsedAt: null,
      };
      credentials.push(credential);
      application.credentialCount += 1;
      return { credential: { ...credential, scopes: [...credential.scopes] }, secret };
    },
    async rotateCredential(id) {
      await delay(500);
      const previous = credentials.find((item) => item.id === id);
      if (!previous || previous.status !== "active") throw new Error("Credential is unavailable");
      previous.status = "revoked";
      const application = applications.find((item) => item.name === previous.applicationName);
      if (!application) throw new Error("Application is unavailable");
      const secret = `dck_live_${crypto.randomUUID().replaceAll("-", "")}`;
      const now = new Date();
      const credential: ApiCredential = {
        ...previous,
        id: `CRD-${String(credentialSeq++).padStart(5, "0")}`,
        clientId: `${previous.clientId}-r${credentialSeq}`,
        keyPrefix: secret.slice(0, 12),
        status: "active",
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        lastUsedAt: null,
        scopes: [...previous.scopes],
      };
      credentials.push(credential);
      return { credential: { ...credential, scopes: [...credential.scopes] }, secret };
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
      const rows = tenants.filter(
        (t) => (!p.status || p.status === "all" || t.status === p.status) && has(p.search, t.name, t.id),
      );
      return paginate(rows.map((tenant) => ({ ...tenant, enabledChannels: [...tenant.enabledChannels], quotas: { ...tenant.quotas } })), p);
    },
    async createTenant(input) {
      await delay(700);
      if (tenants.some((tenant) => tenant.code.toLowerCase() === input.code.toLowerCase())) {
        throw new Error("Tenant code already exists");
      }
      if (users.some((user) => user.email.toLowerCase() === input.contactEmail.toLowerCase())) {
        throw new Error("Administrator email already has portal access");
      }
      const tenant: Tenant = {
        ...input,
        id: `TEN-${String(tenantSeq++).padStart(5, "0")}`,
        users: 1,
        applications: 0,
        messages30d: 0,
        quotaPct: 0,
        createdAt: new Date().toISOString(),
      };
      tenants.push(tenant);
      users.push({
        id: `usr-${String(177 + users.length).padStart(4, "0")}`,
        name: input.contactName,
        email: input.contactEmail,
        role: "client_admin",
        status: "invited",
        mfa: false,
        lastLoginAt: null,
      });
      return { ...tenant, enabledChannels: [...tenant.enabledChannels], quotas: { ...tenant.quotas } };
    },
    async updateTenant(id, input) {
      await delay(500);
      const tenant = tenants.find((item) => item.id === id);
      if (!tenant) throw new Error("Tenant was not found");
      if (tenants.some((item) => item.id !== id && item.code.toLowerCase() === input.code.toLowerCase())) throw new Error("Tenant code already exists");
      Object.assign(tenant, input, { enabledChannels: [...input.enabledChannels], quotas: { ...input.quotas } });
      return { ...tenant, enabledChannels: [...tenant.enabledChannels], quotas: { ...tenant.quotas } };
    },
    async setTenantStatus(id, status) {
      await delay(350);
      const tenant = tenants.find((item) => item.id === id);
      if (tenant) tenant.status = status;
    },
    async listProviders() {
      await delay();
      void BASE_TIME;
      return providers.map((provider) => ({ ...provider }));
    },
    async createProvider(input) {
      await delay(600);
      if (!input.secret.trim()) throw new Error("Provider secret is required");
      if (providers.some((provider) => provider.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Provider name already exists");
      const { secret: _secret, ...config } = input;
      const provider: Provider = {
        ...config,
        id: `PRV-${input.channel.toUpperCase()}-${String(providerSeq++).padStart(2, "0")}`,
        status: "unavailable",
        enabled: true,
        secretConfigured: true,
        latencyMs: 0,
        successRate: 0,
        checkedAt: new Date().toISOString(),
      };
      providers.push(provider);
      return { ...provider };
    },
    async updateProvider(id, input) {
      await delay(500);
      const provider = providers.find((item) => item.id === id);
      if (!provider) throw new Error("Provider was not found");
      if (providers.some((item) => item.id !== id && item.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Provider name already exists");
      const { secret, ...config } = input;
      Object.assign(provider, config, { secretConfigured: provider.secretConfigured || !!secret?.trim() });
      return { ...provider };
    },
    async setProviderEnabled(id, enabled) {
      await delay(300);
      const provider = providers.find((item) => item.id === id);
      if (provider) provider.enabled = enabled;
    },
    async testProviderConnection(id) {
      await delay(700);
      const provider = providers.find((item) => item.id === id);
      if (!provider) throw new Error("Provider was not found");
      const latencyMs = 250 + (provider.name.length * 37) % 500;
      provider.status = provider.enabled ? "healthy" : "unavailable";
      provider.latencyMs = provider.enabled ? latencyMs : 0;
      provider.successRate = provider.enabled ? 99.5 : 0;
      provider.checkedAt = new Date().toISOString();
      return { success: provider.enabled, latencyMs: provider.enabled ? latencyMs : 0 };
    },
    async listBulkJobs() {
      await delay();
      return [...bulkJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((job) => ({ ...job, results: (job.results ?? []).map((result) => ({ ...result })) }));
    },
    async createBulkJob(input) {
      await delay(800);
      const app = applications.find((a) => a.id === input.applicationId);
      const tpl = templates.find((t) => t.id === input.templateId);
      const job: BulkJob = {
        id: `BLK-20261003-${String(bulkSeq++).padStart(5, "0")}`, name: input.name, channel: input.channel,
        applicationName: app?.name ?? "", templateName: tpl?.name ?? null, status: "queued" as const,
        total: input.recipients, delivered: 0, failed: 0, pending: input.recipients, rejected: 0, results: [], createdAt: new Date().toISOString(), createdBy: "You",
      };
      bulkJobs.push(job);
      const recipientRows = input.recipientRows ?? [];
      setTimeout(() => {
        job.status = "processing";
      }, 250);
      setTimeout(() => {
        const results = recipientRows.map(({ recipient }) => {
          const score = [...recipient].reduce((sum, char) => sum + char.charCodeAt(0), 0);
          const status = score % 23 === 0 ? "rejected" as const : score % 11 === 0 ? "failed" as const : "delivered" as const;
          return { recipient, status, errorMessage: status === "failed" ? "Simulated delivery failure" : status === "rejected" ? "Simulated policy rejection" : null };
        });
        job.results = results;
        job.delivered = results.filter((result) => result.status === "delivered").length;
        job.failed = results.filter((result) => result.status === "failed").length;
        job.rejected = results.filter((result) => result.status === "rejected").length;
        job.pending = Math.max(0, job.total - job.delivered - job.failed - job.rejected);
        job.status = job.failed || job.rejected ? "partial" : "completed";
      }, 1200);
      return job;
    },
    async listWebhooks() {
      await delay();
      return webhooks.map((webhook) => ({ ...webhook, events: [...webhook.events], deliveries: webhook.deliveries.map((delivery) => ({ ...delivery })) }));
    },
    async createWebhook(input) {
      await delay(500);
      const signingSecret = `whsec_${crypto.randomUUID().replaceAll("-", "")}`;
      const webhook: Webhook = { ...input, id: `WHK-00${31 + webhooks.length}`, status: "active", signingConfigured: true, lastDeliveryAt: null, successRate: 100, deliveries: [] };
      webhooks.push(webhook);
      return { webhook: { ...webhook, events: [...webhook.events], deliveries: [] }, signingSecret };
    },
    async updateWebhook(id, input) {
      await delay(400);
      const webhook = webhooks.find((item) => item.id === id);
      if (!webhook) throw new Error("Webhook was not found");
      const { signingSecret, ...config } = input;
      Object.assign(webhook, config, { signingConfigured: webhook.signingConfigured || !!signingSecret?.trim() });
      return { ...webhook, events: [...webhook.events], deliveries: webhook.deliveries.map((delivery) => ({ ...delivery })) };
    },
    async setWebhookStatus(id, status) {
      await delay(300);
      const webhook = webhooks.find((item) => item.id === id);
      if (webhook) webhook.status = status;
    },
    async deleteWebhook(id) {
      await delay(350);
      const index = webhooks.findIndex((item) => item.id === id);
      if (index >= 0) webhooks.splice(index, 1);
    },
    async testWebhook(id) {
      await delay(600);
      const webhook = webhooks.find((item) => item.id === id);
      if (!webhook || webhook.status !== "active") throw new Error("Webhook is not active");
      const delivery: WebhookDelivery = { id: `DLV-${Date.now()}`, event: "message.delivered", at: new Date().toISOString(), result: "success", statusCode: 200, attempt: 1 };
      webhook.deliveries.unshift(delivery);
      webhook.lastDeliveryAt = delivery.at;
      webhook.successRate = Math.min(100, webhook.successRate + 0.1);
      return { ...delivery };
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
    async updateUser(id, input) {
      await delay(400);
      const user = users.find((item) => item.id === id);
      if (!user) throw new Error("User was not found");
      Object.assign(user, input);
      return { ...user };
    },
    async setUserStatus(id, status) {
      await delay(350);
      const user = users.find((item) => item.id === id);
      if (user) user.status = status;
    },
    async resendInvitation(id) {
      await delay(350);
      const user = users.find((item) => item.id === id);
      if (!user || user.status !== "invited") throw new Error("Invitation is no longer available");
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
      for (const m of messages) {
        byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
        const a = byApp.get(m.applicationName) ?? { count: 0, failed: 0 };
        a.count++;
        if (m.status === "failed" || m.status === "rejected") a.failed++;
        byApp.set(m.applicationName, a);
      }
      return {
        byStatus: [...byStatus].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
        byApplication: [...byApp].map(([applicationName, v]) => ({ applicationName, ...v })).sort((a, b) => b.count - a.count),
        sampleSize: messages.length,
      };
    },
    async listPlans() {
      await delay();
      return plans.map((plan) => ({ ...plan, entitlements: plan.entitlements.map((e) => ({ ...e })), features: [...plan.features] }));
    },
    async createPlan(input) {
      await delay(500);
      if (plans.some((plan) => plan.code.toLowerCase() === input.code.toLowerCase())) {
        throw new Error("Plan code already exists");
      }
      const plan = { ...input, id: `PLN-${String(planSeq++).padStart(4, "0")}`, tenants: 0 };
      plans.push(plan);
      return { ...plan, entitlements: plan.entitlements.map((e) => ({ ...e })), features: [...plan.features] };
    },
    async updatePlan(id, input) {
      await delay(450);
      const plan = plans.find((item) => item.id === id);
      if (!plan) throw new Error("Plan was not found");
      if (plans.some((item) => item.id !== id && item.code.toLowerCase() === input.code.toLowerCase())) throw new Error("Plan code already exists");
      Object.assign(plan, input, { entitlements: input.entitlements.map((item) => ({ ...item })), features: [...input.features] });
      return { ...plan, entitlements: plan.entitlements.map((item) => ({ ...item })), features: [...plan.features] };
    },
    async setPlanStatus(id, status) {
      await delay(350);
      const plan = plans.find((item) => item.id === id);
      if (plan) plan.status = status;
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
      return [...routingRules].sort((a, b) => a.channel.localeCompare(b.channel) || a.priority - b.priority).map((rule) => ({ ...rule }));
    },
    async createRoutingRule(input) {
      await delay(500);
      const rule: RoutingRule = { ...input, id: `RTE-${String(routingSeq++).padStart(3, "0")}` };
      routingRules.push(rule);
      return { ...rule };
    },
    async updateRoutingRule(id, input) {
      await delay(500);
      const rule = routingRules.find((item) => item.id === id);
      if (!rule) throw new Error("Routing rule was not found");
      Object.assign(rule, input);
      return { ...rule };
    },
    async setRoutingRuleStatus(id, status) {
      await delay(350);
      const rule = routingRules.find((item) => item.id === id);
      if (rule) rule.status = status;
    },
    async listPlatformClients(p) {
      await delay();
      const rows = platformClients.filter(
        (c) => (!p.status || p.status === "all" || c.status === p.status) && has(p.search, c.clientId, c.tenantName),
      );
      return paginate(rows, p);
    },
    async updatePlatformClient(id, rateLimit) {
      await delay(400);
      if (!Number.isFinite(rateLimit) || rateLimit < 1) throw new Error("Rate limit must be a positive number");
      const client = platformClients.find((item) => item.id === id);
      if (!client) throw new Error("API client was not found");
      client.rateLimit = rateLimit;
      return { ...client };
    },
    async setPlatformClientStatus(id, status) {
      await delay(350);
      const client = platformClients.find((item) => item.id === id);
      if (client) client.status = status;
    },
    async listConfig() {
      await delay();
      return config.map((param) => ({ ...param }));
    },
    async updateConfig(key, value) {
      await delay(400);
      const param = config.find((item) => item.key === key);
      if (!param) throw new Error("Configuration parameter was not found");
      if (!value.trim()) throw new Error("Configuration values cannot be empty");
      param.value = value.trim();
      return { ...param };
    },
  };
}
