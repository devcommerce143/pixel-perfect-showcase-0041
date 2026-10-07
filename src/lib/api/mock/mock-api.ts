import type { DolfConnectApi } from "../client";
import type { ApiCredential, Application, ApplicationListQuery, ApiCredentialListQuery, AuditEvent, BulkJob, BulkSuppressionCandidate, Channel, ListParams, Message, MessageStatus, Paginated, Plan, PlanFeatureKey, PortalUser, Provider, ProviderAdapterConfigInput, ProviderUsageBilling, QuotaPolicy, RoutingRule, SenderIdentity, SenderIdentityActor, SenderIdentityInput, SenderIdentityListQuery, SenderIdentityOperationalStatus, SenderIdentityVerificationStatus, Template, Tenant, TenantDirectoryItem, TenantEffectiveEntitlements, TenantEntitlementOverrides, TenantStatus, TenantUpsertInput, TenantUsageTableQuery, UsageSummary, Webhook, WebhookDelivery } from "../types";
import { adapterHasConfiguredSecret, adapterHasRequiredValues, createPublicAdapterConfig, mergeAdapterSecrets } from "../provider-catalog";
import { BULK_JOBS, CHANNELS, CONFIG, PLANS, PLATFORM_CLIENTS, PROVIDER_USAGE_BILLING, ROUTING, SENDER_IDENTITIES, SETTINGS, USERS, WEBHOOKS } from "./mock-data-ext";
import { APPLICATIONS, AUDIT, BASE_TIME, CREDENTIALS, MESSAGES, PROVIDERS, TEMPLATES, TENANTS, TREND } from "./mock-data";

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function paginate<T>(rows: T[], p: ListParams): Paginated<T> {
  const page = p.page ?? 1;
  const pageSize = p.pageSize ?? 20;
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}
const has = (q: string | undefined, ...fields: (string | null)[]) =>
  !q || fields.some((f) => f?.toLowerCase().includes(q.toLowerCase()));

function assertCanManageUser(actor: SenderIdentityActor, user: PortalUser) {
  const allowed = actor.role === "super_admin"
    ? !actor.tenantId || actor.tenantId === user.tenantId
    : actor.role === "client_admin" && !!actor.tenantId && actor.tenantId === user.tenantId;
  if (!allowed) throw new Error("User management is not permitted for this actor");
}

function cloneSenderIdentity(identity: SenderIdentity): SenderIdentity {
  return { ...identity, history: identity.history.map((entry) => ({ ...entry })) };
}

const PLAN_CHANNELS: Channel[] = ["sms", "whatsapp", "email"];
const PLAN_FEATURES: PlanFeatureKey[] = ["api_access", "bulk_messaging", "webhooks", "reporting", "audit_export", "dedicated_sender_identities"];
const TENANT_STATUSES: TenantStatus[] = ["trial", "active", "suspended", "inactive"];

function cloneTenant(tenant: Tenant): Tenant {
  const overrides = tenant.subscription.overrides;
  return {
    ...tenant,
    subscription: {
      ...tenant.subscription,
      overrides: overrides ? {
        ...overrides,
        ...(overrides.channels ? {
          channels: Object.fromEntries(Object.entries(overrides.channels).map(([channel, value]) => [channel, { ...value }])) as NonNullable<TenantEntitlementOverrides["channels"]>,
        } : {}),
      } : null,
    },
  };
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validTenantPhone(value?: string) {
  return !value || /^\+?[0-9\s-]{7,20}$/.test(value.trim());
}

function validatePlanInput(input: Omit<Plan, "id" | "tenants">) {
  if (!/^[A-Z0-9-]{2,32}$/.test(input.code) || !input.name.trim()) throw new Error("Plan code and name are required");
  if (!Number.isSafeInteger(input.tpsLimit) || input.tpsLimit <= 0) throw new Error("Plan rate limit must be a positive integer");
  if (input.quotaPolicy !== "hard_stop" && input.quotaPolicy !== "soft_cap") throw new Error("Plan quota policy is invalid");
  if (input.status === "archived") throw new Error("Plans must be archived through the lifecycle action");
  if (input.entitlements.length !== PLAN_CHANNELS.length || PLAN_CHANNELS.some((channel) => !input.entitlements.some((item) => item.channel === channel))) {
    throw new Error("Exactly one entitlement is required for each channel");
  }
  if (input.entitlements.some((item) => typeof item.enabled !== "boolean" || !Number.isSafeInteger(item.monthly) || item.monthly < 0)) {
    throw new Error("Channel quotas must be non-negative integers with explicit availability");
  }
  if (input.features.some((feature) => !PLAN_FEATURES.includes(feature)) || new Set(input.features).size !== input.features.length) {
    throw new Error("Plan features are invalid");
  }
}

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
  const tenants = TENANTS.map(cloneTenant);
  let tenantSeq = Math.max(0, ...tenants.map((tenant) => Number(tenant.id.slice(-5)))) + 1;
  let auditSeq = AUDIT.length + 1;
  const auditEvents = AUDIT.map((event) => ({ ...event }));
  for (const tenant of tenants) {
    if (!users.some((user) => user.id === tenant.primaryAdministratorId)) {
      const index = Number(tenant.id.slice(-5));
      const firstName = "Tenant";
      const lastName = `Administrator ${index}`;
      users.push({ id: tenant.primaryAdministratorId, tenantId: tenant.id, name: `${firstName} ${lastName}`, firstName, lastName, email: `admin.${tenant.code.toLowerCase()}@example.test`, role: "client_admin", status: "active", mfa: false, lastLoginAt: null });
    }
  }
  const applications = APPLICATIONS.map((application) => ({ ...application, channels: [...application.channels], scopes: [...application.scopes] }));
  let applicationSeq = 225;
  const templates = TEMPLATES.map((template) => ({ ...template }));
  let templateSeq = 151;
  const providers = PROVIDERS.map((provider) => ({ ...provider }));
  const providerAdapterConfigs = new Map<string, ProviderAdapterConfigInput>();
  const senderIdentities = SENDER_IDENTITIES.map(cloneSenderIdentity);
  let senderIdentitySeq = senderIdentities.length + 1;
  let providerSeq = 3;
  const routingRules = ROUTING.map((rule) => ({ ...rule }));
  let routingSeq = routingRules.length + 1;
  const config = CONFIG.map((param) => ({ ...param }));
  const platformClients = PLATFORM_CLIENTS.map((client) => ({ ...client }));
  const messages = MESSAGES.map((message) => ({ ...message, events: [...message.events] }));
  const planForTenant = (tenant: Tenant) => {
    const plan = plans.find((item) => item.id === tenant.subscription.planId);
    if (!plan) throw new Error("Tenant subscription references an unknown plan");
    return plan;
  };
  const resolveEntitlements = (tenant: Tenant, plan = planForTenant(tenant), includeOverrides = true): TenantEffectiveEntitlements => {
    const overrides = includeOverrides ? tenant.subscription.overrides : null;
    const channels = Object.fromEntries(PLAN_CHANNELS.map((channel) => {
      const planEntitlement = plan.entitlements.find((item) => item.channel === channel)!;
      const channelOverride = overrides?.channels?.[channel];
      const enabled = planEntitlement.enabled && (channelOverride?.enabled ?? true);
      return [channel, { enabled, monthly: enabled ? channelOverride?.monthly ?? planEntitlement.monthly : 0 }];
    })) as TenantEffectiveEntitlements["channels"];
    return {
      channels,
      tpsLimit: overrides?.tpsLimit ?? plan.tpsLimit,
      quotaPolicy: overrides?.quotaPolicy ?? plan.quotaPolicy,
      features: [...plan.features],
    };
  };
  const directoryItem = (tenant: Tenant): TenantDirectoryItem => {
    const plan = planForTenant(tenant);
    return {
      ...cloneTenant(tenant),
      planName: plan.name,
      planCode: plan.code,
      planStatus: plan.status,
      planDefaults: resolveEntitlements(tenant, plan, false),
      effectiveEntitlements: resolveEntitlements(tenant, plan),
      primaryAdministrator: { ...users.find((user) => user.id === tenant.primaryAdministratorId)! },
    };
  };
  const recordTenantAudit = (tenant: Tenant, action: string) => {
    const at = new Date().toISOString();
    auditEvents.unshift({ id: `AUD-TEN-${String(auditSeq++).padStart(4, "0")}`, at, actor: "Platform Super Admin", actorType: "user", action, resource: `tenant:${tenant.id}`, result: "success", ip: "127.0.0.1", tenantId: tenant.id, tenantName: tenant.name });
  };
  const validateTenantInput = (input: TenantUpsertInput, existing?: Tenant) => {
    if (!input.name.trim()) throw new Error("Organization name is required");
    const normalizedCode = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,32}$/.test(normalizedCode)) throw new Error("Tenant code is invalid");
    if (!TENANT_STATUSES.includes(input.status)) throw new Error("Tenant status is invalid");
    if (!input.dataRegion.trim() || !input.timezone.trim()) throw new Error("Tenant data region and time zone are required");
    if (input.defaultLanguage !== "en" && input.defaultLanguage !== "ar") throw new Error("Tenant language is invalid");
    if (!input.primaryAdministrator.firstName.trim() || !input.primaryAdministrator.lastName.trim()) throw new Error("Primary administrator is required");
    if (!validEmail(input.primaryAdministrator.email)) throw new Error("Administrator email is invalid");
    if (!validTenantPhone(input.primaryAdministrator.mobileNumber)) throw new Error("Administrator mobile number is invalid");
    if (input.primaryAdministrator.preferredLanguage !== "en" && input.primaryAdministrator.preferredLanguage !== "ar") throw new Error("Administrator language is invalid");
    if (tenants.some((tenant) => tenant.id !== existing?.id && tenant.code.toUpperCase() === normalizedCode)) throw new Error("Tenant code already exists");
    if (users.some((user) => user.id !== existing?.primaryAdministratorId && user.email.toLowerCase() === input.primaryAdministrator.email.toLowerCase())) throw new Error("Administrator email already has portal access");
    const plan = plans.find((item) => item.id === input.planId);
    if (!plan) throw new Error("Subscription plan is required");
    if ((!existing || existing.subscription.planId !== input.planId) && plan.status !== "active") throw new Error("Only active plans are available for new subscriptions");
    const overrides = input.overrides;
    if (!overrides) return;
    if (overrides.tpsLimit !== undefined && (!Number.isSafeInteger(overrides.tpsLimit) || overrides.tpsLimit <= 0)) throw new Error("Tenant rate limit must be a positive whole number");
    if (overrides.quotaPolicy !== undefined && !["hard_stop", "soft_cap"].includes(overrides.quotaPolicy)) throw new Error("Tenant quota policy is invalid");
    for (const channel of PLAN_CHANNELS) {
      const override = overrides.channels?.[channel];
      if (!override) continue;
      const planChannel = plan.entitlements.find((item) => item.channel === channel)!;
      if (override.enabled === true && !planChannel.enabled) throw new Error("Tenant overrides cannot enable a channel excluded by the plan");
      if (override.monthly !== undefined && (!Number.isSafeInteger(override.monthly) || override.monthly < 0)) throw new Error("Tenant channel quotas must be non-negative whole numbers");
      if (!planChannel.enabled && override.monthly !== undefined && override.monthly !== 0) throw new Error("A disabled channel cannot have an effective quota");
      if (override.enabled === false && (override.monthly ?? 0) > 0) throw new Error("A disabled channel cannot have an effective quota");
    }
  };
  const authorizedTenantScope = (actor: SenderIdentityActor, requestedTenantId?: string) => {
    if (actor.role !== "super_admin") {
      if (!actor.tenantId) throw new Error("Tenant context is required for this operation");
      return actor.tenantId;
    }
    if (!requestedTenantId) return undefined;
    if (!tenants.some((tenant) => tenant.id === requestedTenantId && (tenant.status === "active" || tenant.status === "trial"))) throw new Error("Tenant is not available to this actor");
    return requestedTenantId;
  };
  const assertTenantAccess = (actor: SenderIdentityActor, tenantId: string) => {
    const scope = authorizedTenantScope(actor, tenantId);
    if (scope && scope !== tenantId) throw new Error("Tenant is not available to this actor");
  };

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
    async listMessages(p, actor) {
      await delay();
      const tenantScope = authorizedTenantScope(actor, p.tenantId);
      const rows = messages.filter(
        (m) =>
          (!tenantScope || m.tenantId === tenantScope) &&
          (!p.channel || p.channel === "all" || m.channel === p.channel) &&
          (!p.status || p.status === "all" || m.status === p.status) &&
          has(p.search, m.id, m.recipient, m.templateName, m.applicationName),
      );
      return paginate(rows, p);
    },
    async getMessage(id, actor, tenantId) {
      await delay(150);
      const message = messages.find((m) => m.id === id);
      const tenantScope = authorizedTenantScope(actor, tenantId);
      if (message && tenantScope && message.tenantId !== tenantScope) return null;
      return message ? { ...message, events: [...message.events] } : null;
    },
    async sendMessage(input, actor) {
      await delay(700);
      const id = `MSG-20261004-${String(seq++).padStart(6, "0")}`;
      const now = new Date().toISOString();
      const application = applications.find((item) => item.id === input.applicationId);
        if (!application) throw new Error("Application was not found");
      if (actor.role === "super_admin") throw new Error("Platform administrators cannot send tenant messages");
      assertTenantAccess(actor, application.tenantId);
      const template = templates.find((item) => item.id === input.templateId);
      const message: Message = {
        id,
        channel: input.channel,
        recipient: input.recipient,
          tenantId: application.tenantId,
        applicationId: input.applicationId,
          applicationName: application.name,
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
    async listTemplates(p, actor) {
      await delay();
      const tenantScope = authorizedTenantScope(actor, p.filters?.tenantId);
      const filters = p.filters;
      const rows = templates.filter(
        (t) =>
          (!tenantScope || t.tenantId === tenantScope) &&
          (!filters?.channel || filters.channel === "all" || t.channel === filters.channel) &&
          (!filters?.status || filters.status === "all" || t.status === filters.status) &&
          (!filters?.tenantId || t.tenantId === filters.tenantId) &&
          has(p.search, t.name, t.category, t.tenantName ?? t.tenantId ?? ""),
      );
      const field = p.sortBy ?? "name";
      const direction = p.sortDirection === "desc" ? -1 : 1;
      rows.sort((a, b) => String(a[field] ?? "").localeCompare(String(b[field] ?? ""), undefined, { numeric: true }) * direction);
      return paginate(rows, { ...p, pageSize: p.pageSize ?? 50 });
    },
    async createTemplate(actor, input) {
      await delay(500);
      if (actor.role !== "client_admin" || !actor.tenantId) throw new Error("Template creation is not permitted for this actor");
      if (templates.some((template) => template.name.toLowerCase() === input.name.trim().toLowerCase() && template.channel === input.channel)) {
        throw new Error("Template name already exists for this channel");
      }
      const tenantName = tenants.find((tenant) => tenant.id === actor.tenantId)?.name;
      const template: Template = {
        ...input,
        tenantId: actor.tenantId,
        ...(tenantName ? { tenantName } : {}),
        id: `TPL-${String(templateSeq++).padStart(4, "0")}`,
        status: input.channel === "whatsapp" ? "pending_approval" : "draft",
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      templates.unshift(template);
      return { ...template };
    },
    async updateTemplate(actor, id, input) {
      await delay(450);
      const template = templates.find((item) => item.id === id);
      if (!template) throw new Error("Template was not found");
      if (!template.tenantId) throw new Error("Template is not available to this actor");
      assertTenantAccess(actor, template.tenantId);
      if (templates.some((item) => item.id !== id && item.channel === input.channel && item.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Template name already exists for this channel");
      Object.assign(template, input, { status: input.channel === "whatsapp" ? "pending_approval" : "draft", version: template.version + 1, updatedAt: new Date().toISOString() });
      return { ...template };
    },
    async submitTemplateForApproval(actor, id) {
      await delay(400);
      const template = templates.find((item) => item.id === id);
      if (!template) throw new Error("Template was not found");
      if (!template.tenantId) throw new Error("Template is not available to this actor");
      assertTenantAccess(actor, template.tenantId);
      const submittedAt = new Date().toISOString();
      template.status = "pending_approval";
      template.approval = { provider: "Meta Cloud API", status: "pending", submittedAt, reviewedAt: null, rejectionReason: null };
      return { ...template };
    },
    async activateTemplate(actor, id) {
      await delay(300);
      const template = templates.find((item) => item.id === id);
      if (!template) throw new Error("Template was not found");
      if (!template.tenantId) throw new Error("Template is not available to this actor");
      assertTenantAccess(actor, template.tenantId);
      template.status = "active";
      return { ...template };
    },
    async deactivateTemplate(actor, id) {
      await delay(300);
      const template = templates.find((item) => item.id === id);
      if (!template) throw new Error("Template was not found");
      if (!template.tenantId) throw new Error("Template is not available to this actor");
      assertTenantAccess(actor, template.tenantId);
      template.status = "inactive";
      return { ...template };
    },
    async listApplications(actor, tenantId) {
      await delay();
      const tenantScope = authorizedTenantScope(actor, tenantId);
      return applications.filter((application) => !tenantScope || application.tenantId === tenantScope).map((application) => ({ ...application, channels: [...application.channels], scopes: [...application.scopes] }));
    },
    async listApplicationsPage(actor, query: ApplicationListQuery) {
      await delay();
      const tenantScope = authorizedTenantScope(actor, query.filters?.tenantId);
      const rows = applications.filter((application) =>
        (!tenantScope || application.tenantId === tenantScope) &&
        (!query.filters?.status || query.filters.status === "all" || application.status === query.filters.status) &&
        has(query.search, application.name, application.id, application.tenantName ?? application.tenantId),
      );
      const direction = query.sortDirection === "desc" ? -1 : 1;
      rows.sort((a, b) => {
        const field = query.sortBy ?? "name";
        const aValue = field === "name" || field === "status" ? a[field] : a[field] ?? "";
        const bValue = field === "name" || field === "status" ? b[field] : b[field] ?? "";
        return String(aValue).localeCompare(String(bValue), undefined, { numeric: true }) * direction;
      });
      return paginate(rows.map((application) => ({ ...application, channels: [...application.channels], scopes: [...application.scopes] })), query);
    },
    async createApplication(actor, input) {
      await delay(500);
      assertTenantAccess(actor, input.tenantId);
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
    async updateApplication(actor, id, input) {
      await delay(450);
      const application = applications.find((item) => item.id === id);
      if (!application) throw new Error("Application was not found");
      assertTenantAccess(actor, application.tenantId);
      if (applications.some((item) => item.id !== id && item.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Application name already exists");
      Object.assign(application, input, { channels: [...input.channels], scopes: [...input.scopes] });
      return { ...application, channels: [...application.channels], scopes: [...application.scopes] };
    },
    async setApplicationStatus(actor, id, status) {
      await delay(300);
      const application = applications.find((item) => item.id === id);
      if (application) { assertTenantAccess(actor, application.tenantId); application.status = status; }
    },
    async listCredentials(actor, query: ApiCredentialListQuery) {
      await delay();
      const tenantScope = authorizedTenantScope(actor, query.filters?.tenantId);
      const rows = credentials.filter((credential) =>
        (!tenantScope || credential.tenantId === tenantScope) &&
        (!query.filters?.applicationId || credential.applicationId === query.filters.applicationId) &&
        (!query.filters?.status || query.filters.status === "all" || credential.status === query.filters.status) &&
        has(query.search, credential.clientId, credential.applicationName, credential.id),
      );
      const direction = query.sortDirection === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        const field = query.sortBy ?? "createdAt";
        const aValue = a[field] ?? "";
        const bValue = b[field] ?? "";
        return String(aValue).localeCompare(String(bValue), undefined, { numeric: true }) * direction;
      });
      return paginate(rows.map((credential) => ({ ...credential, scopes: [...credential.scopes] })), query);
    },
    async createCredential(actor, input) {
      await delay(500);
      const application = applications.find((item) => item.id === input.applicationId);
      if (!application || application.status !== "active") throw new Error("Application is unavailable");
      assertTenantAccess(actor, application.tenantId);
      if (!input.scopes.length || input.scopes.some((scope) => !application.scopes.includes(scope))) {
        throw new Error("Credential scopes exceed application permissions");
      }
      const secret = `dck_live_${crypto.randomUUID().replaceAll("-", "")}`;
      const now = new Date();
      const tenantName = tenants.find((tenant) => tenant.id === application.tenantId)?.name;
      const credential: ApiCredential = {
        id: `CRD-${String(credentialSeq++).padStart(5, "0")}`,
        tenantId: application.tenantId,
          ...(tenantName ? { tenantName } : {}),
        applicationId: application.id,
        applicationName: application.name,
        clientId: `dc-${application.id.toLowerCase()}-${credentialSeq}`,
        keyPrefix: secret.slice(0, 12),
        environment: input.environment ?? application.environment,
        status: "active",
        scopes: [...input.scopes],
        createdAt: now.toISOString(),
        expiresAt: input.expiresAt === undefined ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : input.expiresAt,
        lastUsedAt: null,
        rateLimit: input.rateLimit ?? null,
      };
      credentials.push(credential);
      application.credentialCount += 1;
      return { credential: { ...credential, scopes: [...credential.scopes] }, secret };
    },
    async rotateCredential(actor, id) {
      await delay(500);
      const previous = credentials.find((item) => item.id === id);
      if (!previous || previous.status !== "active") throw new Error("Credential is unavailable");
      assertTenantAccess(actor, previous.tenantId);
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
    async revokeCredential(actor, id) {
      await delay(400);
      const c = credentials.find((x) => x.id === id);
      if (c) { assertTenantAccess(actor, c.tenantId); c.status = "revoked"; }
    },
    async listAuditEvents(p, actor) {
      await delay();
      const tenantScope = authorizedTenantScope(actor, p.tenantId);
      const rows = auditEvents.filter(
        (a) => (!tenantScope || a.tenantId === tenantScope) && (!p.status || p.status === "all" || a.result === p.status) && has(p.search, a.actor, a.action, a.resource),
      );
      const enrichedRows = rows.map((event) => {
        const tenantName = event.tenantId ? tenants.find((tenant) => tenant.id === event.tenantId)?.name : undefined;
        return { ...event, ...(tenantName ? { tenantName } : {}) };
      });
      return paginate(enrichedRows, p);
    },
    async getUsage(actor, tenantId?: string, tableQuery?: TenantUsageTableQuery): Promise<UsageSummary> {
      await delay();
      const tenantScope = authorizedTenantScope(actor, tenantId);
      const visibleTenants = tenants.filter((tenant) => {
        return !tenantScope || tenant.id === tenantScope;
      });
      const periodStart = new Date(Date.UTC(2026, 9, 1)).toISOString();
      const periodEnd = new Date(Date.UTC(2026, 9, 31)).toISOString();
      const summaries = visibleTenants.map((tenant) => {
        const usagePercent = Math.max(0, Math.min(100, tenant.quotaPct));
        const entitlements = resolveEntitlements(tenant);
        const plan = planForTenant(tenant);
        const channels = PLAN_CHANNELS
          .filter((channel) => entitlements.channels[channel].enabled)
          .map((channel) => ({ channel, used: Math.round(entitlements.channels[channel].monthly * usagePercent / 100), limit: entitlements.channels[channel].monthly }));
        const used = channels.reduce((total, channel) => total + channel.used, 0);
        const limit = channels.reduce((total, channel) => total + channel.limit, 0);
        const actualPercent = limit ? used / limit * 100 : 0;
        const status = actualPercent >= 100 ? "at_limit" as const : actualPercent >= 90 ? "warning" as const : actualPercent >= 80 ? "approaching" as const : "normal" as const;
        const tenantApplications = applications.filter((application) => application.tenantId === tenant.id);
        const applicationUsage = tenantApplications.map((application) => ({
          applicationId: application.id,
          applicationName: application.name,
          channels: channels.filter((channel) => application.channels.includes(channel.channel)).map((channel) => ({ channel: channel.channel, used: Math.round(channel.used / Math.max(1, tenantApplications.filter((item) => item.channels.includes(channel.channel)).length)) })),
        }));
        return {
          tenant: {
            tenantId: tenant.id,
            tenantName: tenant.name,
            plan: plan.name,
            status,
            quotaPolicy: entitlements.quotaPolicy,
            tpsLimit: entitlements.tpsLimit,
            periodStart,
            periodEnd,
            renewalDate: periodEnd,
            channels,
            applications: applicationUsage,
          },
          row: { tenantId: tenant.id, tenantName: tenant.name, plan: plan.name, used, limit, remaining: Math.max(0, limit - used), usagePercent: actualPercent, status, quotaPolicy: entitlements.quotaPolicy },
        };
      });
      const filtered = summaries.filter(({ row }) =>
        has(tableQuery?.search, row.tenantName, row.tenantId) &&
        (!tableQuery?.plan || tableQuery.plan === "all" || row.plan === tableQuery.plan) &&
        (!tableQuery?.status || tableQuery.status === "all" || row.status === tableQuery.status) &&
        (!tableQuery?.quotaPolicy || tableQuery.quotaPolicy === "all" || row.quotaPolicy === tableQuery.quotaPolicy),
      );
      const sortBy = tableQuery?.sortBy ?? "usagePercent";
      const sortDirection = tableQuery?.sortDirection === "asc" ? 1 : -1;
      filtered.sort((a, b) => {
        const aValue = a.row[sortBy];
        const bValue = b.row[sortBy];
        return (typeof aValue === "string" ? aValue.localeCompare(String(bValue)) : aValue - Number(bValue)) * sortDirection;
      });
      const page = tableQuery?.page ?? 1;
      const pageSize = tableQuery?.pageSize ?? 10;
      const tenantTable = paginate(filtered.map(({ row }) => row), { page, pageSize });
      const tenantSummaries = summaries.map(({ tenant }) => tenant);
      const channelTotals = PLAN_CHANNELS.map((channel) => ({
        channel,
        used: tenantSummaries.reduce((total, tenant) => total + (tenant.channels.find((item) => item.channel === channel)?.used ?? 0), 0),
        limit: tenantSummaries.reduce((total, tenant) => total + (tenant.channels.find((item) => item.channel === channel)?.limit ?? 0), 0),
      }));
      return {
        periodStart,
        periodEnd,
        tenants: tenantSummaries,
        channels: channelTotals,
        planOptions: [...new Set(tenantSummaries.map((tenant) => tenant.plan))].sort(),
        tenantTable,
      };
    },
    async listTenants(p) {
      await delay();
      const rows = tenants.filter((tenant) => {
        const administrator = users.find((user) => user.id === tenant.primaryAdministratorId);
        const plan = planForTenant(tenant);
        return (!p.filters?.status || p.filters.status === "all" || tenant.status === p.filters.status) && has(p.search, tenant.name, tenant.id, tenant.code, plan.name, administrator?.name ?? null, administrator?.email ?? null);
      });
      const direction = p.sortDirection === "desc" ? -1 : 1;
      rows.sort((a, b) => {
        const aValue = p.sortBy === "quotaPct" ? a.quotaPct : p.sortBy === "plan" ? planForTenant(a).name : a[p.sortBy ?? "name"];
        const bValue = p.sortBy === "quotaPct" ? b.quotaPct : p.sortBy === "plan" ? planForTenant(b).name : b[p.sortBy ?? "name"];
        return (typeof aValue === "number" ? aValue - Number(bValue) : String(aValue).localeCompare(String(bValue), undefined, { numeric: true })) * direction;
      });
      return paginate(rows.map(directoryItem), p);
    },
    async createTenant(input) {
      await delay(700);
      validateTenantInput(input);
      const now = new Date().toISOString();
      const id = `TEN-${String(tenantSeq++).padStart(5, "0")}`;
      const primaryAdministratorId = `usr-${String(1000 + users.length).padStart(4, "0")}`;
      const plan = plans.find((item) => item.id === input.planId)!;
      const tenant: Tenant = {
        id,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        status: input.status,
        region: input.region.trim(),
        dataRegion: input.dataRegion.trim(),
        defaultLanguage: input.defaultLanguage,
        timezone: input.timezone.trim(),
        notes: input.notes.trim(),
        subscription: { id: `SUB-${id.slice(-5)}`, planId: plan.id, status: input.status === "trial" ? "trial" : input.status === "inactive" ? "cancelled" : "active", overrides: input.overrides, createdAt: now, updatedAt: now },
        primaryAdministratorId,
        users: 1,
        applications: 0,
        messages30d: 0,
        quotaPct: 0,
        createdAt: now,
        updatedAt: now,
      };
      tenants.push(tenant);
      users.push({
        id: primaryAdministratorId,
        tenantId: id,
        tenantName: tenant.name,
        name: `${input.primaryAdministrator.firstName.trim()} ${input.primaryAdministrator.lastName.trim()}`,
        firstName: input.primaryAdministrator.firstName.trim(),
        lastName: input.primaryAdministrator.lastName.trim(),
        firstNameArabic: input.primaryAdministrator.firstNameArabic?.trim() || null,
        lastNameArabic: input.primaryAdministrator.lastNameArabic?.trim() || null,
        email: input.primaryAdministrator.email.trim(),
        mobileNumber: input.primaryAdministrator.mobileNumber?.trim() || null,
        jobTitle: input.primaryAdministrator.jobTitle?.trim() || null,
        department: input.primaryAdministrator.department?.trim() || null,
        preferredLanguage: input.primaryAdministrator.preferredLanguage,
        role: "client_admin",
        status: "pending_activation",
        mfa: false,
        lastLoginAt: null,
      });
      recordTenantAudit(tenant, "tenant.created");
      recordTenantAudit(tenant, "subscription.assigned");
      return directoryItem(tenant);
    },
    async updateTenant(id, input) {
      await delay(500);
      const tenant = tenants.find((item) => item.id === id);
      if (!tenant) throw new Error("Tenant was not found");
      validateTenantInput(input, tenant);
      const previousPlanId = tenant.subscription.planId;
      const previousOverrides = JSON.stringify(tenant.subscription.overrides);
      if (previousPlanId !== input.planId && tenant.subscription.overrides && input.overrides) throw new Error("Clear tenant overrides before changing plans");
      Object.assign(tenant, { code: input.code.trim().toUpperCase(), name: input.name.trim(), status: input.status, region: input.region.trim(), dataRegion: input.dataRegion.trim(), defaultLanguage: input.defaultLanguage, timezone: input.timezone.trim(), notes: input.notes.trim(), updatedAt: new Date().toISOString() });
      tenant.subscription = { ...tenant.subscription, planId: input.planId, overrides: input.overrides, updatedAt: tenant.updatedAt };
      const administrator = users.find((user) => user.id === tenant.primaryAdministratorId);
      if (!administrator) throw new Error("Primary administrator was not found");
      Object.assign(administrator, {
        name: `${input.primaryAdministrator.firstName.trim()} ${input.primaryAdministrator.lastName.trim()}`,
        firstName: input.primaryAdministrator.firstName.trim(),
        lastName: input.primaryAdministrator.lastName.trim(),
        firstNameArabic: input.primaryAdministrator.firstNameArabic?.trim() || null,
        lastNameArabic: input.primaryAdministrator.lastNameArabic?.trim() || null,
        email: input.primaryAdministrator.email.trim(),
        mobileNumber: input.primaryAdministrator.mobileNumber?.trim() || null,
        jobTitle: input.primaryAdministrator.jobTitle?.trim() || null,
        department: input.primaryAdministrator.department?.trim() || null,
        preferredLanguage: input.primaryAdministrator.preferredLanguage,
      });
      recordTenantAudit(tenant, "tenant.updated");
      if (previousPlanId !== input.planId) recordTenantAudit(tenant, "subscription.plan_changed");
      if (previousOverrides !== JSON.stringify(input.overrides)) recordTenantAudit(tenant, "tenant.override_changed");
      return directoryItem(tenant);
    },
    async setTenantStatus(id, status) {
      await delay(350);
      if (!TENANT_STATUSES.includes(status)) throw new Error("Tenant status is invalid");
      const tenant = tenants.find((item) => item.id === id);
      if (!tenant) throw new Error("Tenant was not found");
      tenant.status = status;
      tenant.updatedAt = new Date().toISOString();
      recordTenantAudit(tenant, status === "suspended" ? "tenant.suspended" : status === "active" ? "tenant.reactivated" : "tenant.status_changed");
    },
    async listProviders() {
      await delay();
      void BASE_TIME;
      return providers.map((provider) => ({ ...provider }));
      },
    async getProviderUsageBilling(actor, providerId): Promise<ProviderUsageBilling | null> {
      await delay();
      if (actor.role !== "super_admin") throw new Error("Provider usage is not available to this actor");
      const usage = PROVIDER_USAGE_BILLING[providerId];
      return usage ? { ...usage, ...(usage.categories ? { categories: usage.categories.map((category) => ({ ...category })) } : {}) } : null;
    },
    async createProvider(input) {
      await delay(600);
      if (!adapterHasRequiredValues(input.adapterConfig)) throw new Error("Provider configuration is incomplete");
      if (providers.some((provider) => provider.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Provider name already exists");
      const now = new Date().toISOString();
      const provider: Provider = {
        ...input,
        id: `PRV-${input.channel.toUpperCase()}-${String(providerSeq++).padStart(2, "0")}`,
        adapterId: input.adapterConfig.adapterId,
        adapterConfig: createPublicAdapterConfig(input.adapterConfig),
        status: "unavailable",
        enabled: true,
        secretConfigured: adapterHasConfiguredSecret(input.adapterConfig),
        latencyMs: 0,
        successRate: 0,
        checkedAt: now,
        lastConnectionTest: null,
        health: { reason: "provider_unavailable", lastSuccessfulCheckAt: null, statusSince: now, requests24h: 0, failures24h: 0, lastFailureAt: null, lastFailureReason: null },
      };
      providers.push(provider);
      providerAdapterConfigs.set(provider.id, input.adapterConfig);
      return { ...provider };
    },
    async updateProvider(id, input) {
      await delay(500);
      const provider = providers.find((item) => item.id === id);
      if (!provider) throw new Error("Provider was not found");
      if (providers.some((item) => item.id !== id && item.name.toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Provider name already exists");
      const sameAdapter = provider.adapterId === input.adapterConfig.adapterId;
      const currentConfig = providerAdapterConfigs.get(id);
      const adapterConfig = currentConfig && sameAdapter ? mergeAdapterSecrets(currentConfig, input.adapterConfig) : input.adapterConfig;
      if (!adapterHasRequiredValues(adapterConfig, sameAdapter && provider.secretConfigured)) throw new Error("Provider configuration is incomplete");
      Object.assign(provider, {
        name: input.name,
        channel: input.channel,
        environment: input.environment,
        dataRegion: input.dataRegion,
        adapterId: adapterConfig.adapterId,
        adapterConfig: createPublicAdapterConfig(adapterConfig),
        secretConfigured: provider.secretConfigured || adapterHasConfiguredSecret(adapterConfig),
      });
      providerAdapterConfigs.set(id, adapterConfig);
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
      const testedAt = new Date().toISOString();
      const result = { outcome: provider.enabled ? "success" as const : "provider_unavailable" as const, success: provider.enabled, latencyMs: provider.enabled ? latencyMs : 0, testedAt };
      provider.checkedAt = testedAt;
      provider.lastConnectionTest = result;
      provider.health = {
        ...provider.health,
        reason: provider.enabled ? "operational" : "provider_disabled",
        lastSuccessfulCheckAt: provider.enabled ? testedAt : provider.health.lastSuccessfulCheckAt,
        statusSince: provider.enabled ? null : provider.health.statusSince ?? testedAt,
        requests24h: provider.health.requests24h + 1,
        failures24h: provider.health.failures24h + (provider.enabled ? 0 : 1),
        lastFailureAt: provider.enabled ? provider.health.lastFailureAt : testedAt,
        lastFailureReason: provider.enabled ? provider.health.lastFailureReason : "provider_disabled",
      };
      return result;
    },
    async listBulkJobs(actor, query) {
      await delay();

      const tenantScopedId = authorizedTenantScope(actor, query.filters?.tenantId);
      const rows = bulkJobs
        .filter((job) => {
          if (actor.role !== "super_admin" && job.tenantId !== actor.tenantId) return false;
          if (actor.role === "super_admin" && tenantScopedId && job.tenantId !== tenantScopedId) return false;
          if (query.filters?.channel && query.filters.channel !== "all" && job.channel !== query.filters.channel) return false;
          if (query.filters?.status && query.filters.status !== "all" && job.status !== query.filters.status) return false;
          if (query.search) {
            const needle = query.search.toLowerCase();
            const haystacks = [job.id, job.name, job.applicationName, job.tenantName ?? job.tenantId ?? ""];
            if (!haystacks.some((value) => value.toLowerCase().includes(needle))) return false;
          }
          return true;
        })
        .sort((a, b) => {
          const direction = query.sortDirection === "asc" ? 1 : -1;
          switch (query.sortBy) {
            case "status":
              return (a.status.localeCompare(b.status) || b.createdAt.localeCompare(a.createdAt)) * direction;
            case "progress": {
              const aProgress = a.total ? Math.min(100, ((a.delivered + a.failed + (a.rejected ?? 0)) / a.total) * 100) : 0;
              const bProgress = b.total ? Math.min(100, ((b.delivered + b.failed + (b.rejected ?? 0)) / b.total) * 100) : 0;
              return (aProgress - bProgress) * direction;
            }
            case "createdAt":
            default:
              return a.createdAt.localeCompare(b.createdAt) * direction;
          }
        })
        .map((job) => ({ ...job, results: (job.results ?? []).map((result) => ({ ...result })) }));

      return paginate(rows, query);
    },
    async getBulkJob(actor, id, tenantId) {
      await delay();
      const job = bulkJobs.find((item) => item.id === id);
      if (!job) return null;
      const requestedTenant = authorizedTenantScope(actor, tenantId);
      if (requestedTenant && job.tenantId !== requestedTenant) return null;
      if (actor.role !== "super_admin" && job.tenantId !== actor.tenantId) return null;
      return { ...job, results: (job.results ?? []).map((result) => ({ ...result })) };
    },
    async listBulkTemplates(actor, applicationId, channel) {
      await delay();
      const application = applications.find((item) => item.id === applicationId);
      if (!application || !application.channels.includes(channel)) return [];
      if (actor.role !== "super_admin" && application.tenantId !== actor.tenantId) return [];
      return templates.filter((template) => template.channel === channel && template.tenantId === application.tenantId && (template.status === "active" || template.status === "approved")).map((template) => ({ ...template }));
    },
    async checkBulkSuppression(actor, applicationId, _candidates: BulkSuppressionCandidate[]) {
      await delay();
      const application = applications.find((item) => item.id === applicationId);
      if (!application || (actor.role !== "super_admin" && application.tenantId !== actor.tenantId)) throw new Error("Application is not available to this actor");
      return [];
    },
    async createBulkJob(actor, input) {
      await delay(800);
      const app = applications.find((a) => a.id === input.applicationId);
      if (actor.role === "super_admin" || !app || app.tenantId !== actor.tenantId) throw new Error("Bulk job creation is not available to this actor");
      const tpl = templates.find((t) => t.id === input.templateId);
      const tenantName = tenants.find((tenant) => tenant.id === app.tenantId)?.name;
      const job: BulkJob = {
        id: `BLK-20261003-${String(bulkSeq++).padStart(5, "0")}`, name: input.name, channel: input.channel,
        tenantId: app.tenantId, ...(tenantName ? { tenantName } : {}),
        applicationId: input.applicationId, senderIdentityId: input.senderIdentityId, templateId: input.templateId,
        applicationName: app.name, templateName: tpl?.name ?? null, status: "queued" as const,
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
        const rejected = results.filter((result) => result.status === "rejected").length;
        job.rejected = rejected;
        job.pending = Math.max(0, job.total - job.delivered - job.failed - rejected);
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
    async listUsers(actor, query) {
      await delay();
      if (actor.role !== "super_admin" && actor.role !== "client_admin") throw new Error("User list access is not permitted for this actor");
      if (actor.role === "client_admin" && !actor.tenantId) throw new Error("Tenant context is required to view users");

      const tenantScopedId = authorizedTenantScope(actor, query.filters?.tenantId);
      const rows = users
        .filter((user) => {
          if (actor.role === "super_admin") return !tenantScopedId || user.tenantId === tenantScopedId;
          return user.tenantId === actor.tenantId;
        })
        .map((user) => ({
          ...user,
          tenantName: tenants.find((tenant) => tenant.id === user.tenantId)?.name ?? user.tenantId ?? "",
        }));

      const filtered = rows.filter((user) => {
        const statusMatches = !query.filters?.status || query.filters.status === "all" || user.status === query.filters.status;
        const tenantMatches = !query.filters?.tenantId || user.tenantId === query.filters.tenantId;
        const searchMatches = has(query.search, user.name, user.email, user.tenantName ?? "");
        return statusMatches && tenantMatches && searchMatches;
      });

      const dir = query.sortDirection === "desc" ? -1 : 1;
      const sorted = [...filtered].sort((a, b) => {
        const field = query.sortBy ?? "name";
        const valueFor = (user: PortalUser & { tenantName?: string }) => field === "tenantName" ? user.tenantName ?? "" : field === "lastLoginAt" ? user.lastLoginAt ?? "" : field === "name" ? user.name : field === "role" ? user.role : user.status;
        const aStr = valueFor(a).toLowerCase();
        const bStr = valueFor(b).toLowerCase();
        return aStr.localeCompare(bStr, undefined, { numeric: true }) * dir;
      });

      return paginate(sorted, query);
    },
    async inviteUser(actor, input) {
      await delay(500);
      if (actor.role !== "super_admin" && actor.role !== "client_admin") throw new Error("User invitation is not permitted");
      const tenantId = input.tenantId ?? actor.tenantId;
      if (!tenantId) throw new Error("Tenant context is required to invite users");
      if (actor.role === "client_admin" && !actor.tenantId) throw new Error("Tenant context is required to invite users");
      if (actor.role === "super_admin" && !tenants.some((tenant) => tenant.id === tenantId && (tenant.status === "active" || tenant.status === "trial"))) throw new Error("Tenant is not available for invitations");
      const normalizedName = [input.firstName ?? input.name?.split(" ")[0] ?? "", input.lastName ?? input.name?.split(" ").slice(1).join(" ") ?? ""].filter(Boolean).join(" ") || input.name || "New user";
      const u = {
        ...input,
        id: `usr-0${170 + users.length}`,
        name: normalizedName,
        firstName: input.firstName ?? normalizedName.split(" ")[0] ?? "",
        lastName: input.lastName ?? normalizedName.split(" ").slice(1).join(" ") ?? "",
        status: "pending_activation" as const,
        mfa: false,
        lastLoginAt: null,
        tenantId,
      };
      users.push(u);
      return u;
    },
    async updateUser(actor, id, input) {
      await delay(400);
      const user = users.find((item) => item.id === id);
      if (!user) throw new Error("User was not found");
      assertCanManageUser(actor, user);
      const normalizedName = [input.firstName ?? user.firstName ?? "", input.lastName ?? user.lastName ?? ""].filter(Boolean).join(" ") || input.name || user.name;
      Object.assign(user, input, {
        name: normalizedName,
        firstName: input.firstName ?? user.firstName ?? "",
        lastName: input.lastName ?? user.lastName ?? "",
        firstNameArabic: input.firstNameArabic ?? user.firstNameArabic ?? null,
        lastNameArabic: input.lastNameArabic ?? user.lastNameArabic ?? null,
        mobileNumber: input.mobileNumber ?? user.mobileNumber ?? null,
        jobTitle: input.jobTitle ?? user.jobTitle ?? null,
        department: input.department ?? user.department ?? null,
        preferredLanguage: input.preferredLanguage ?? user.preferredLanguage ?? "en",
      });
      return { ...user };
    },
    async setUserStatus(actor, id, status) {
      await delay(350);
      const user = users.find((item) => item.id === id);
      if (user) {
        assertCanManageUser(actor, user);
        user.status = status;
      }
    },
    async resendInvitation(actor, id) {
      await delay(350);
      const user = users.find((item) => item.id === id);
      if (!user || user.status !== "invited") throw new Error("Invitation is no longer available");
      assertCanManageUser(actor, user);
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
    async getReport(actor, tenantId) {
      await delay();
      const tenantScope = authorizedTenantScope(actor, tenantId);
      const reportMessages = messages.filter((message) => !tenantScope || message.tenantId === tenantScope);
      const byStatus = new Map<MessageStatus, number>();
      const byApp = new Map<string, { count: number; failed: number }>();
      for (const m of reportMessages) {
        byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
        const a = byApp.get(m.applicationName) ?? { count: 0, failed: 0 };
        a.count++;
        if (m.status === "failed" || m.status === "rejected") a.failed++;
        byApp.set(m.applicationName, a);
      }
      return {
        byStatus: [...byStatus].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
        byApplication: [...byApp].map(([applicationName, v]) => ({ applicationName, ...v })).sort((a, b) => b.count - a.count),
        sampleSize: reportMessages.length,
        trend: tenantScope ? TREND.map((point) => {
          const dayMessages = reportMessages.filter((message) => message.createdAt.slice(0, 10) === point.date);
          const delivered = dayMessages.filter((message) => ["sent", "delivered", "read"].includes(message.status)).length;
          const failed = dayMessages.filter((message) => message.status === "failed" || message.status === "rejected").length;
          return { date: point.date, delivered, failed, pending: dayMessages.length - delivered - failed };
        }) : TREND,
      };
    },
    async listPlans() {
      await delay();
      return plans.map((plan) => ({ ...plan, tenants: tenants.filter((tenant) => tenant.subscription.planId === plan.id).length, entitlements: plan.entitlements.map((e) => ({ ...e })), features: [...plan.features] }));
    },
    async createPlan(input) {
      await delay(500);
      validatePlanInput(input);
      if (plans.some((plan) => plan.code.toLowerCase() === input.code.toLowerCase())) {
        throw new Error("Plan code already exists");
      }
      const plan = { ...input, entitlements: input.entitlements.map((item) => ({ ...item })), features: [...input.features], id: `PLN-${String(planSeq++).padStart(4, "0")}`, tenants: 0 };
      plans.push(plan);
      return { ...plan, entitlements: plan.entitlements.map((e) => ({ ...e })), features: [...plan.features] };
    },
    async updatePlan(id, input) {
      await delay(450);
      const plan = plans.find((item) => item.id === id);
      if (!plan) throw new Error("Plan was not found");
      if (plan.status === "archived") throw new Error("Archived plans are read-only");
      validatePlanInput(input);
      if (input.code !== plan.code) throw new Error("Plan code cannot be changed after creation");
      if (plans.some((item) => item.id !== id && item.code.toLowerCase() === input.code.toLowerCase())) throw new Error("Plan code already exists");
      Object.assign(plan, input, { entitlements: input.entitlements.map((item) => ({ ...item })), features: [...input.features] });
      return { ...plan, entitlements: plan.entitlements.map((item) => ({ ...item })), features: [...plan.features] };
    },
    async setPlanStatus(id, status) {
      await delay(350);
      const plan = plans.find((item) => item.id === id);
      if (!plan) throw new Error("Plan was not found");
      if (plan.status === "archived") throw new Error("Archived plans are read-only");
      plan.status = status;
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
    async listPlatformClients(p, actor) {
      await delay();
      if (actor.role !== "super_admin") throw new Error("API Client monitoring is restricted to platform administrators");
      const tenantScope = authorizedTenantScope(actor, p.filters?.tenantId);
      const rows = platformClients.filter(
        (c) => (!tenantScope || c.tenantId === tenantScope) && (!p.filters?.status || p.filters.status === "all" || c.status === p.filters.status) && has(p.search, c.clientId, c.tenantName),
      );
      const direction = p.sortDirection === "desc" ? -1 : 1;
      rows.sort((a, b) => {
        const field = p.sortBy ?? "clientId";
        const aValue = a[field] ?? "";
        const bValue = b[field] ?? "";
        return String(aValue).localeCompare(String(bValue), undefined, { numeric: true }) * direction;
      });
      return paginate(rows, p);
    },
    async updatePlatformClient(actor, id, rateLimit) {
      await delay(400);
      if (actor.role !== "super_admin") throw new Error("API Client management is restricted to platform administrators");
      if (!Number.isFinite(rateLimit) || rateLimit < 1) throw new Error("Rate limit must be a positive number");
      const client = platformClients.find((item) => item.id === id);
      if (!client) throw new Error("API client was not found");
      assertTenantAccess(actor, client.tenantId);
      client.rateLimit = rateLimit;
      return { ...client };
    },
    async setPlatformClientStatus(actor, id, status) {
      await delay(350);
      if (actor.role !== "super_admin") throw new Error("API Client management is restricted to platform administrators");
      const client = platformClients.find((item) => item.id === id);
      if (client) { assertTenantAccess(actor, client.tenantId); client.status = status; }
    },
    async listSenderIdentities(actor, query: SenderIdentityListQuery) {
      await delay();
      const requestedTenant = authorizedTenantScope(actor, query.filters?.tenantId);
      const rows = senderIdentities
        .filter((identity) => actor.role === "super_admin" ? !requestedTenant || identity.tenantId === requestedTenant : identity.tenantId === actor.tenantId)
        .filter((identity) =>
          (!query.filters?.channel || query.filters.channel === "all" || identity.channel === query.filters.channel) &&
          (!query.filters?.verificationStatus || query.filters.verificationStatus === "all" || identity.verificationStatus === query.filters.verificationStatus) &&
          (!query.filters?.operationalStatus || query.filters.operationalStatus === "all" || identity.operationalStatus === query.filters.operationalStatus) &&
          has(query.search, identity.id, identity.identityValue, identity.displayName, tenants.find((tenant) => tenant.id === identity.tenantId)?.name ?? identity.tenantId),
        );
      const direction = query.sortDirection === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        const field = query.sortBy ?? "updatedAt";
        const value = (identity: SenderIdentity) => field === "tenantName" ? tenants.find((tenant) => tenant.id === identity.tenantId)?.name ?? identity.tenantId : identity[field];
        return String(value(a)).localeCompare(String(value(b)), undefined, { numeric: true }) * direction;
      });
      return paginate(rows.map(cloneSenderIdentity), query);
    },
    async getSenderIdentity(actor, id) {
      await delay();
      const identity = senderIdentities.find((item) => item.id === id);
      if (!identity || (actor.role !== "super_admin" && identity.tenantId !== actor.tenantId) || (actor.role === "super_admin" && actor.tenantId && identity.tenantId !== actor.tenantId)) return null;
      return cloneSenderIdentity(identity);
    },
    async listSendableSenderIdentities(actor, applicationId, channel) {
      await delay();
      const application = applications.find((item) => item.id === applicationId);
      if (!application || (actor.role !== "super_admin" && application.tenantId !== actor.tenantId)) return [];
      return senderIdentities
        .filter((identity) => identity.tenantId === application.tenantId && identity.channel === channel && identity.verificationStatus === "verified" && identity.operationalStatus === "active" && (!application.senderIdentityIds || application.senderIdentityIds.includes(identity.id)))
        .map(cloneSenderIdentity);
    },
    async createSenderIdentity(actor, input: SenderIdentityInput) {
      await delay(500);
      const tenantId = actor.role === "super_admin" ? input.tenantId : actor.tenantId;
      if (!tenantId || (actor.role !== "super_admin" && actor.role !== "client_admin")) throw new Error("Tenant context is required to register a sender identity");
      assertTenantAccess(actor, tenantId);
      const now = new Date().toISOString();
      const base = {
        id: `SID-${String(senderIdentitySeq++).padStart(5, "0")}`,
        tenantId,
        verificationStatus: "draft" as const,
        operationalStatus: "inactive" as const,
        createdAt: now,
        createdBy: actor.name || "You",
        updatedAt: now,
        submittedAt: null,
        verificationStartedAt: null,
        verifiedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        activatedAt: null,
        suspendedAt: null,
        suspensionReason: null,
        history: [{ action: "created" as const, at: now, actor: actor.name || "You", note: null }],
      };
      let identity: SenderIdentity;
      if (input.channel === "sms") identity = { ...base, channel: "sms", identityType: "sms_sender_id", identityValue: input.identityValue, displayName: input.displayName, countryMarket: input.countryMarket, providerReference: input.providerReference };
      else if (input.channel === "whatsapp") identity = { ...base, channel: "whatsapp", identityType: "whatsapp_business_number", identityValue: input.identityValue, displayName: input.displayName, businessDisplayName: input.businessDisplayName, phoneNumber: input.phoneNumber, countryCode: input.countryCode, wabaId: input.wabaId, phoneNumberId: input.phoneNumberId, providerReference: input.providerReference };
      else identity = { ...base, channel: "email", identityType: "email_domain_sender", identityValue: input.identityValue, displayName: input.displayName, emailAddress: input.emailAddress, domain: input.domain, domainVerificationStatus: "unverified", spfStatus: "missing", dkimStatus: "missing", providerReference: input.providerReference };
      senderIdentities.push(identity);
      return cloneSenderIdentity(identity);
    },
    async updateSenderIdentity(actor, id, input: SenderIdentityInput) {
      await delay(400);
      const identity = senderIdentities.find((item) => item.id === id);
      if (!identity || identity.channel !== input.channel || (actor.role !== "super_admin" && identity.tenantId !== actor.tenantId)) throw new Error("Sender identity is not available to this actor");
      const now = new Date().toISOString();
      Object.assign(identity, input, { tenantId: identity.tenantId, updatedAt: now, history: [...identity.history, { action: "metadata_updated" as const, at: now, actor: actor.name || "You", note: null }] });
      return cloneSenderIdentity(identity);
    },
    async submitSenderIdentity(actor, id) {
      await delay(350);
      const identity = senderIdentities.find((item) => item.id === id);
      if (!identity || (actor.role !== "super_admin" && identity.tenantId !== actor.tenantId)) throw new Error("Sender identity is not available to this actor");
      const now = new Date().toISOString();
      identity.verificationStatus = "submitted";
      identity.submittedAt = now;
      identity.updatedAt = now;
      identity.history.push({ action: "submitted", at: now, actor: actor.name || "You", note: null });
      return cloneSenderIdentity(identity);
    },
    async startSenderIdentityVerification(actor, id) {
      await delay(350);
      if (actor.role !== "super_admin") throw new Error("Sender identity verification is restricted to platform administrators");
      const identity = senderIdentities.find((item) => item.id === id);
      if (!identity) throw new Error("Sender identity was not found");
      const now = new Date().toISOString();
      identity.verificationStatus = "pending_verification";
      identity.verificationStartedAt = now;
      identity.updatedAt = now;
      identity.history.push({ action: "verification_started", at: now, actor: actor.name || "Platform administrator", note: null });
      return cloneSenderIdentity(identity);
    },
    async setSenderIdentityVerification(actor, id, result: { status: Extract<SenderIdentityVerificationStatus, "verified" | "rejected">; reason?: string }) {
      await delay(400);
      if (actor.role !== "super_admin") throw new Error("Sender identity verification is restricted to platform administrators");
      const identity = senderIdentities.find((item) => item.id === id);
      if (!identity) throw new Error("Sender identity was not found");
      const now = new Date().toISOString();
      identity.verificationStatus = result.status;
      identity.verifiedAt = result.status === "verified" ? now : null;
      identity.rejectedAt = result.status === "rejected" ? now : null;
      identity.rejectionReason = result.status === "rejected" ? result.reason ?? "" : null;
      identity.updatedAt = now;
      identity.history.push({ action: result.status, at: now, actor: actor.name || "Platform administrator", note: result.status === "rejected" ? result.reason ?? "" : null });
      return cloneSenderIdentity(identity);
    },
    async setSenderIdentityOperationalStatus(actor, id, action, reason) {
      await delay(350);
      if (actor.role !== "super_admin") throw new Error("Sender identity operations are restricted to platform administrators");
      const identity = senderIdentities.find((item) => item.id === id);
      if (!identity) throw new Error("Sender identity was not found");
      if (action === "suspend" && !reason?.trim()) throw new Error("A suspension reason is required");
      const now = new Date().toISOString();
      identity.operationalStatus = action === "suspend" ? "suspended" : "active";
      if (action === "suspend") { identity.suspendedAt = now; identity.suspensionReason = reason!.trim(); }
      if (action === "activate" || action === "reactivate") identity.activatedAt = now;
      identity.updatedAt = now;
      identity.history.push({ action: action === "activate" ? "activated" : action === "reactivate" ? "reactivated" : "suspended", at: now, actor: actor.name || "Platform administrator", note: action === "suspend" ? reason!.trim() : null });
      return cloneSenderIdentity(identity);
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
