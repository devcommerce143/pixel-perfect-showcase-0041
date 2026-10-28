/** Typed models mirroring the Dolf Connect API contract (presentation-layer view). */
import type { Role } from "../auth/permissions";
export type { Role } from "../auth/permissions";

export type Channel = "sms" | "whatsapp" | "email";

export type MessageStatus =
  | "queued"
  | "processing"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "rejected"
  | "expired"
  | "cancelled";

export type MessageAttemptKind = "initial" | "retry" | "failover";
export type MessageAttemptResult = "in_progress" | "accepted" | "delivered" | "failed" | "rejected" | "timeout" | "unavailable";
export type MessageFailureStage = "validation" | "authorization" | "entitlement" | "sender_identity" | "quota" | "routing" | "provider_delivery";
export type MessageFailureCategory = "validation" | "authorization" | "entitlement" | "sender_identity" | "quota" | "routing" | "provider_timeout" | "provider_unavailable" | "provider_rejected" | "delivery_failure";

export interface MessageAttempt {
  number: number;
  providerId: string;
  providerName: string;
  startedAt: string;
  completedAt: string | null;
  result: MessageAttemptResult;
  failureCategory: MessageFailureCategory | null;
  failureReason: string | null;
  providerReference: string | null;
  kind: MessageAttemptKind;
}

export interface MessageFailure {
  stage: MessageFailureStage;
  category: MessageFailureCategory;
  reason: string;
  failoverAttempted: boolean;
  finalResult: "rejected" | "failed";
}

export interface MessageRoutingDelivery {
  routingRuleId: string | null;
  routingRuleName: string | null;
  initialProviderId: string | null;
  initialProviderName: string | null;
  finalProviderId: string | null;
  finalProviderName: string | null;
  failoverOccurred: boolean;
  totalProviderAttempts: number;
  finalProviderReference: string | null;
}

export interface MessageEvent {
  status: MessageStatus | "accepted";
  at: string;
}

export interface Message {
  id: string;
  channel: Channel;
  recipient: string;
  tenantId: string;
  applicationId: string;
  applicationName: string;
  templateName: string | null;
  templateId?: string | null;
  templateVersion?: number | null;
  subject?: string | null;
  status: MessageStatus;
  createdAt: string;
  submittedAt?: string;
  updatedAt: string;
  tenantName: string;
  correlationId: string;
  segments: number;
  source: "api" | "portal" | "bulk";
  bulkJobId: string | null;
  senderIdentityId?: string;
  senderIdentityValue?: string;
  clientReference?: string | null;
  idempotencyReference?: string | null;
  idempotencyStatus?: "stored" | "duplicate" | "not_applicable";
  routingDelivery?: MessageRoutingDelivery;
  attempts?: MessageAttempt[];
  statusHistory?: MessageEvent[];
  failure?: MessageFailure | null;
  errorCode: string | null;
  errorMessage: string | null;
  preview: string;
  events: MessageEvent[];
}

export type MessageHistoryStatus =
  | "accepted"
  | "queued"
  | "dispatching"
  | "submitted"
  | "failed"
  | "unknown"
  | "delivered"
  | "read";

export interface MessageHistoryItem {
  id: string;
  applicationId: string;
  channel: Channel;
  status: MessageHistoryStatus;
  acceptedAt: string;
  queuedAt: string | null;
}

export interface PlatformMessageHistoryItem extends MessageHistoryItem {
  tenantId: string;
  tenantName: string;
}

export interface MessageHistoryAttempt {
  attemptNumber: number;
  state: "submitting" | "accepted" | "rejected" | "unknown";
  errorCategory: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface MessageHistoryContent {
  state: 'available' | 'purged' | 'expired' | 'unavailable';
  body: string | null;
  subject: string | null;
  templateVariables: string | null;
}
export interface MessageHistoryDetail extends MessageHistoryItem {
  contentTemplateId?: string | null;
  template?: { key: string; language: string; version?: number } | null;
  content?: MessageHistoryContent;
  senderIdentityId: string;
  templateId: string | null;
  correlationId: string | null;
  contentPurgedAt: string | null;
  recipientNormalized: string;
  attempts: MessageHistoryAttempt[];
}

export interface MessageHistoryQuery {
  acceptedFrom: string;
  acceptedTo: string;
  applicationId?: string;
  page: number;
  pageSize: number;
  channel?: Channel;
  status?: MessageHistoryStatus;
}

export interface MessageHistoryDateRange {
  from: string;
  through: string;
}

export type TemplateStatus = "active" | "inactive" | "draft" | "pending_approval" | "approved" | "rejected";
export interface TemplateApproval {
  provider: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}
export interface TemplateVersion {
  version: number;
  subject: string | null;
  body: string;
  status: TemplateStatus;
  updatedAt: string;
  updatedBy?: string;
  approval?: TemplateApproval | null;
}
export interface Template {
  id: string;
  tenantId?: string;
  tenantName?: string;
  name: string;
  channel: Channel;
  category: "Authentication" | "Transactional" | "Notification" | "Marketing";
  language: "en" | "ar";
  status: TemplateStatus;
  subject: string | null;
  version: number;
  updatedAt: string;
  createdAt?: string;
  createdBy?: string;
  updatedBy?: string;
  body: string;
  variables?: string[];
  approval?: TemplateApproval | null;
  versionHistory?: TemplateVersion[];
}

export type SenderIdentityVerificationStatus = "draft" | "submitted" | "pending_verification" | "verified" | "rejected";
export type SenderIdentityOperationalStatus = "inactive" | "active" | "suspended";
export type SenderIdentityHistoryAction = "created" | "metadata_updated" | "submitted" | "verification_started" | "verified" | "rejected" | "activated" | "suspended" | "reactivated";

export interface SenderIdentityHistoryEntry {
  action: SenderIdentityHistoryAction;
  at: string;
  actor: string;
  note: string | null;
}

interface SenderIdentityBase {
  id: string;
  tenantId: string;
  identityValue: string;
  displayName: string | null;
  verificationStatus: SenderIdentityVerificationStatus;
  operationalStatus: SenderIdentityOperationalStatus;
  providerReference: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  submittedAt: string | null;
  verificationStartedAt: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  history: SenderIdentityHistoryEntry[];
}

export interface SmsSenderIdentity extends SenderIdentityBase {
  channel: "sms";
  identityType: "sms_sender_id";
  countryMarket: string;
}

export interface WhatsAppSenderIdentity extends SenderIdentityBase {
  channel: "whatsapp";
  identityType: "whatsapp_business_number";
  businessDisplayName: string;
  phoneNumber: string;
  countryCode: string;
  wabaId: string | null;
  phoneNumberId: string | null;
}

export interface EmailSenderIdentity extends SenderIdentityBase {
  channel: "email";
  identityType: "email_domain_sender";
  emailAddress: string;
  domain: string;
  domainVerificationStatus: "unverified" | "pending" | "verified" | "failed";
  spfStatus: "missing" | "pending" | "valid" | "invalid";
  dkimStatus: "missing" | "pending" | "valid" | "invalid";
}

export type SenderIdentity = SmsSenderIdentity | WhatsAppSenderIdentity | EmailSenderIdentity;

export type SenderDomainCheckStatus = "not_configured" | "pending" | "verified" | "failed";
export type SenderEmailAuthStatus = "not_configured" | "pending" | "verified" | "failed";

interface SenderIdentityReadBase {
  id: string;
  tenantId: string;
  displayName: string | null;
  verificationStatus: SenderIdentityVerificationStatus;
  operationalStatus: SenderIdentityOperationalStatus;
  providerReference: string | null;
  rejectionReason: string | null;
  suspensionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmsSenderIdentityRead extends SenderIdentityReadBase {
  channel: "sms";
  sms: { senderId: string; countryCode: string };
}

export interface EmailSenderIdentityRead extends SenderIdentityReadBase {
  channel: "email";
  email: {
    emailAddress: string;
    domain: string;
    domainVerificationStatus: SenderDomainCheckStatus;
    spfStatus: SenderEmailAuthStatus;
    dkimStatus: SenderEmailAuthStatus;
  };
}

export interface WhatsAppSenderIdentityRead extends SenderIdentityReadBase {
  channel: "whatsapp";
  whatsapp: {
    businessDisplayName: string;
    phoneNumber: string;
    countryCode: string;
    wabaId: string;
    phoneNumberId: string;
  };
}

export type SenderIdentityRead =
  | SmsSenderIdentityRead
  | EmailSenderIdentityRead
  | WhatsAppSenderIdentityRead;

export type PlatformSenderIdentityRead = SenderIdentityRead & {
  tenantName: string;
};

export type SenderIdentityInput =
  | Pick<SmsSenderIdentity, "channel" | "identityValue" | "displayName" | "countryMarket" | "providerReference"> & { tenantId?: string }
  | Pick<WhatsAppSenderIdentity, "channel" | "identityValue" | "displayName" | "businessDisplayName" | "phoneNumber" | "countryCode" | "wabaId" | "phoneNumberId" | "providerReference"> & { tenantId?: string }
  | Pick<EmailSenderIdentity, "channel" | "identityValue" | "displayName" | "emailAddress" | "domain" | "providerReference"> & { tenantId?: string };

export interface SenderIdentityActor {
  role: Role;
  tenantId: string | null;
  userId: string;
  name: string;
}

export interface SenderIdentityFilters {
  tenantId?: string;
  channel?: Channel | "all";
  verificationStatus?: SenderIdentityVerificationStatus | "all";
  operationalStatus?: SenderIdentityOperationalStatus | "all";
  search?: string;
}

export interface Application {
  id: string;
  tenantId: string;
  tenantName?: string;
  name: string;
  environment: "production" | "sandbox";
  status: "active" | "disabled";
  channels: Channel[];
  scopes: string[];
  senderAccess?: "all_eligible" | "allow_list";
  allowListSenderIds?: string[];
  channelAvailability?: ApplicationChannelAvailability[];
  credentialCount?: number;
  createdAt: string;
  lastActivityAt?: string | null;
  createdBy?: string;
  updatedAt?: string;
  senderIdentityIds?: string[];
}

export interface PlatformApplication extends Application {
  tenantName: string;
}

export interface ApplicationChannelAvailability {
  channel: Channel;
  granted: boolean;
  available: boolean;
}

export interface ApiCredential {
  id: string;
  tenantId: string;
  tenantName?: string;
  applicationId: string;
  applicationName: string;
  clientId: string;
  keyPrefix: string;
  environment: "production" | "sandbox";
  status: "active" | "revoked" | "expired";
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  rateLimit?: number | null;
  createdBy?: string;
  revokedAt?: string | null;
  revokedBy?: string | null;
  rotatedFromCredentialId?: string | null;
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
  tenantId?: string;
  tenantName?: string;
  senderIdentityId?: string;
}

export type TenantStatus = "trial" | "active" | "suspended" | "inactive";

export interface TenantChannelOverride {
  enabled?: boolean;
  monthly?: number;
}

export interface TenantEntitlementOverrides {
  channels?: Partial<Record<Channel, TenantChannelOverride>>;
  tpsLimit?: number;
  quotaPolicy?: QuotaPolicy;
}

export type TenantSubscriptionStatus = "trial" | "active" | "pending" | "cancelled";

export interface TenantSubscription {
  id: string;
  planId: string;
  status: TenantSubscriptionStatus;
  overrides: TenantEntitlementOverrides | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantEffectiveEntitlements {
  channels: Record<Channel, { enabled: boolean; monthly: number }>;
  tpsLimit: number;
  quotaPolicy: QuotaPolicy;
  features: PlanFeatureKey[];
}

export interface TenantAdministratorProfile {
  firstName: string;
  lastName: string;
  firstNameArabic?: string;
  lastNameArabic?: string;
  email: string;
  mobileNumber?: string;
  jobTitle?: string;
  department?: string;
  preferredLanguage: "en" | "ar";
}

export interface TenantUpsertInput {
  code: string;
  name: string;
  status: TenantStatus;
  region: string;
  dataRegion: string;
  defaultLanguage: "en" | "ar";
  timezone: string;
  notes: string;
  planId: string;
  overrides: TenantEntitlementOverrides | null;
  primaryAdministrator: TenantAdministratorProfile;
}

export interface TenantProfileUpdateInput {
  name?: string;
  notes?: string | null;
  defaultLanguage?: "en" | "ar";
  timezone?: string;
}

export interface TenantProfileUpdateRequest {
  name?: string;
  notes?: string | null;
  defaultLanguage?: "EN" | "AR";
  timezone?: string;
}

export interface TenantCreateRequest {
  code: string;
  name: string;
  dataRegion: string;
  status?: "TRIAL" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
  defaultLanguage?: "EN" | "AR";
  timezone?: string;
  notes?: string | null;
  primaryAdmin?: {
    email: string;
    firstName: string;
    lastName: string;
    firstNameAr?: string | null;
    lastNameAr?: string | null;
    mobile?: string | null;
    preferredLanguage?: "EN" | "AR";
  };
}

export interface TenantCreatedPrimaryAdmin {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  mobile: string | null;
  jobTitle: string | null;
  department: string | null;
  preferredLanguage: "en" | "ar";
  role: "platform_super_admin" | "client_admin" | "operator" | "viewer";
  status: "invited" | "active" | "suspended" | "disabled";
  createdAt: string;
  updatedAt: string;
}

export interface TenantCreateResponse {
  tenant: TenantDetail;
  primaryAdmin: TenantCreatedPrimaryAdmin | null;
}

export interface Tenant {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
  region: string;
  dataRegion: string;
  defaultLanguage: "en" | "ar";
  timezone: string;
  notes: string;
  subscription: TenantSubscription;
  primaryAdministratorId: string;
  users: number;
  applications: number;
  messages30d: number;
  quotaPct: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDirectoryItem extends Tenant {
  planName: string;
  planCode: string;
  planStatus: Plan["status"];
  planDefaults: TenantEffectiveEntitlements;
  effectiveEntitlements: TenantEffectiveEntitlements;
  primaryAdministrator: PortalUser | null;
}

/** Fields returned by the platform tenant-list endpoint before enrichment APIs are joined. */
export interface TenantCatalogItem {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
  dataRegion: string;
  defaultLanguage: "en" | "ar";
  timezone: string;
  notes: string | null;
  primaryAdminUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TenantDetail = Omit<TenantCatalogItem, "primaryAdminUserId"> & {
  primaryAdminUserId: string | null;
};

export type SubscriptionRecordStatus = "trial" | "active" | "pending" | "cancelled";
export type EntitlementValueSource = "plan" | "subscription" | "channel" | "unavailable";
export type EntitlementBlocker =
  | "TENANT_SUSPENDED"
  | "TENANT_INACTIVE"
  | "SUBSCRIPTION_MISSING"
  | "SUBSCRIPTION_PENDING"
  | "SUBSCRIPTION_CANCELLED"
  | "SUBSCRIPTION_NOT_STARTED"
  | "SUBSCRIPTION_ENDED";

export interface TenantSubscriptionRecord {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionRecordStatus;
  startsAt: string;
  endsAt: string | null;
  tpsLimitOverride: number | null;
  quotaPolicyOverride: QuotaPolicy | null;
  channelOverrides: {
    channel: Channel;
    enabledOverride: boolean | null;
    monthlyQuotaOverride: number | null;
    tpsOverride: number | null;
  }[];
  plan: Plan;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedTenantChannel {
  channel: Channel;
  enabled: boolean;
  monthlyQuota: number | null;
  tpsLimit: number | null;
  quotaSource: EntitlementValueSource;
  tpsSource: EntitlementValueSource;
  ignoredOverride: boolean;
}

export interface ResolvedTenantEntitlements {
  tenantId: string;
  tenantStatus: TenantStatus;
  subscriptionId: string | null;
  planId: string | null;
  configured: boolean;
  operational: boolean;
  blockers: EntitlementBlocker[];
  quotaPolicy: QuotaPolicy | null;
  quotaPolicySource: "plan" | "subscription" | null;
  tpsLimit: number | null;
  tpsSource: "plan" | "subscription" | null;
  features: PlanFeatureKey[];
  channels: ResolvedTenantChannel[];
}

export interface TenantSubscriptionView {
  subscription: TenantSubscriptionRecord | null;
  effective: ResolvedTenantEntitlements;
}

export interface TenantSubscriptionHistoryPage {
  items: TenantSubscriptionRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TenantSubscriptionHistoryQuery {
  page: number;
  pageSize: number;
}

export interface TenantSubscriptionOverridesInput {
  tpsLimitOverride?: number | null;
  quotaPolicyOverride?: QuotaPolicy | null;
}

export interface TenantSubscriptionChannelOverrideInput {
  enabledOverride?: boolean | null;
  monthlyQuotaOverride?: number | null;
  tpsOverride?: number | null;
}

export type TenantPlanAssignmentResult = Omit<TenantSubscriptionView, "subscription"> & {
  subscription: TenantSubscriptionRecord;
};

export type TenantPlanAssignmentStatus = "trial" | "active";

export interface TenantPlanAssignmentInput {
  planId: string;
  status: TenantPlanAssignmentStatus;
}

export type ProviderEnvironment = "production" | "sandbox";
export type ProviderAdapterId =
  | "taqnyat"
  | "infobip"
  | "twilio"
  | "smsCustom"
  | "metaCloudApi"
  | "customBsp"
  | "awsSes"
  | "smtp"
  | "emailCustom";

export interface ProviderAdapterConfigMap {
  taqnyat: { apiBaseUrl: string; apiKey: string };
  infobip: { apiBaseUrl: string; apiKey: string };
  twilio: { accountSid: string; authToken: string; fromNumber: string };
  smsCustom: { apiBaseUrl: string; credential: string; apiSecret: string };
  metaCloudApi: { wabaId: string; phoneNumberId: string; accessToken: string; webhookUrl: string; webhookStatus: "configured" | "pending" };
  customBsp: { apiBaseUrl: string; apiKey: string; apiSecret: string };
  awsSes: { awsRegion: string; accessKeyId: string; secretAccessKey: string };
  smtp: { host: string; port: string; username: string; password: string; secure: boolean };
  emailCustom: { apiBaseUrl: string; apiKey: string; apiSecret: string };
}

export interface ProviderAdapterPublicConfigMap {
  taqnyat: { apiBaseUrl: string };
  infobip: { apiBaseUrl: string };
  twilio: { accountSid: string; fromNumber: string };
  smsCustom: { apiBaseUrl: string };
  metaCloudApi: { wabaId: string; phoneNumberId: string; webhookUrl: string; webhookStatus: "configured" | "pending" };
  customBsp: { apiBaseUrl: string };
  awsSes: { awsRegion: string };
  smtp: { host: string; port: string; username: string; secure: boolean };
  emailCustom: { apiBaseUrl: string };
}

export type ProviderAdapterConfigInput = {
  [AdapterId in ProviderAdapterId]: { adapterId: AdapterId; values: ProviderAdapterConfigMap[AdapterId] }
}[ProviderAdapterId];

export type ProviderAdapterConfigSummary = {
  [AdapterId in ProviderAdapterId]: { adapterId: AdapterId; values: ProviderAdapterPublicConfigMap[AdapterId] }
}[ProviderAdapterId];

export type ProviderTestOutcome = "success" | "authentication_failed" | "timeout" | "provider_unavailable";

export interface ProviderTestResult {
  outcome: ProviderTestOutcome;
  success: boolean;
  latencyMs: number;
  testedAt: string;
}

export type ProviderUsageSource = "development_sample" | "provider_api" | "internal_metering" | "manual";
export type ProviderUsageUnit = "messages" | "emails" | "sms_segments" | "billable_messages";

export interface ProviderUsageMetric {
  amount: number;
  unit: ProviderUsageUnit;
}

export interface ProviderUsageCategory {
  name: "marketing" | "utility" | "authentication" | "service";
  messages: number;
}

export interface ProviderUsageAllowance {
  total: number;
  used: number;
  remaining: number;
  unit: ProviderUsageUnit;
}

export interface ProviderUsageBilling {
  source: ProviderUsageSource;
  periodStart: string;
  periodEnd: string;
  lastSyncedAt?: string;
  trafficRouted?: ProviderUsageMetric;
  billableUsage?: ProviderUsageMetric;
  categories?: ProviderUsageCategory[];
  allowance?: ProviderUsageAllowance;
  accountBalance?: { amount: number; currency: string };
  estimatedCost?: { amount: number; currency: string };
}

export type ProviderHealthReason = "operational" | "latency_threshold" | "connection_timeout" | "authentication_failed" | "provider_unavailable" | "provider_disabled";

export interface ProviderHealth {
  reason: ProviderHealthReason;
  lastSuccessfulCheckAt: string | null;
  statusSince: string | null;
  requests24h: number;
  failures24h: number;
  lastFailureAt: string | null;
  lastFailureReason: ProviderHealthReason | null;
}

export interface Provider {
  id: string;
  name: string;
  channel: Channel;
  adapterId: ProviderAdapterId;
  environment: ProviderEnvironment;
  dataRegion: string;
  adapterConfig: ProviderAdapterConfigSummary;
  status: "healthy" | "degraded" | "unavailable";
  enabled: boolean;
  secretConfigured: boolean;
  latencyMs: number;
  successRate: number;
  checkedAt: string;
  lastConnectionTest: ProviderTestResult | null;
  health: ProviderHealth;
}

export interface ProviderConfigInput {
  name: string;
  channel: Channel;
  environment: ProviderEnvironment;
  dataRegion: string;
  adapterConfig: ProviderAdapterConfigInput;
}

export interface TrendPoint {
  date: string;
  delivered: number;
  failed: number;
  pending: number;
}

export interface DashboardSummary {
  /** Present for a live engine summary. Mock summaries omit it. */
  scope?: "platform" | "tenant";
  kpis: {
    total: number;
    delivered: number;
    pending: number;
    failed: number;
    /**
     * Delivered ÷ total × 100. Null when total is 0.
     * Live totals include submitted and unknown, so this rate does not treat them as delivered.
     */
    deliveryRate: number | null;
    /** Null when the source has no previous-window comparison. */
    totalDeltaPct: number | null;
    /** SUBMITTED messages. Counted in total and omitted from delivered, pending, and failed. */
    submitted?: number;
    /** UNKNOWN messages. Counted in total and omitted from pending and failed. */
    unknown?: number;
  };
  trend: TrendPoint[];
  channels: { channel: Channel; count: number }[];
  /** Null when this scope has no single positive monthly limit. */
  quota: { used: number; limit: number } | null;
}

/** Stored engine statuses. They are not collapsed into delivered, pending, or failed. */
export type DashboardRecentMessageStatus =
  | "accepted"
  | "queued"
  | "dispatching"
  | "submitted"
  | "failed"
  | "unknown"
  | "delivered"
  | "read";

export interface DashboardRecentMessage {
  id: string;
  channel: Channel;
  status: DashboardRecentMessageStatus;
  acceptedAt: string;
  applicationName: string;
  templateKey: string | null;
  tenantId: string;
  tenantName: string;
  /** Present for tenant scope only. Omitted for platform scope. */
  recipient?: string;
}

export interface DashboardRecentMessages {
  scope: "platform" | "tenant";
  tenantId: string | null;
  items: DashboardRecentMessage[];
}

/** Backend warning band. The portal does not derive this from a percentage. */
export type QuotaWarningBand = "none" | "80" | "90" | "100";

export interface QuotaUsageReading {
  committed: number;
  reserved: number;
  /** Committed plus reserved on this counter. Not the sum of channel counters. */
  used: number;
  ceiling: number | null;
  band: QuotaWarningBand;
  overage: number | null;
}

export interface DashboardQuotaChannel extends QuotaUsageReading {
  channel: Channel;
  enabled: boolean;
}

export interface TenantDashboardQuota {
  scope: "tenant";
  tenantId: string;
  periodStart: string;
  configured: boolean;
  policy: QuotaPolicy | null;
  policySource: "plan" | "subscription" | null;
  aggregate: QuotaUsageReading;
  channels: DashboardQuotaChannel[];
}

export interface PlatformDashboardQuota {
  scope: "platform";
  tenantId: null;
  periodStart: string;
  counts: {
    atOrAbove80: number;
    atOrAbove90: number;
    atOrAbove100: number;
    unconfigured: number;
  };
}

export type DashboardQuotaWarning = TenantDashboardQuota | PlatformDashboardQuota;

export type QuotaPolicy = "hard_stop" | "soft_cap";
export type UsageQuotaStatus = "normal" | "approaching" | "warning" | "at_limit";

export interface TenantUsageSummary {
  tenantId: string;
  tenantName: string;
  plan: string;
  status: UsageQuotaStatus;
  quotaPolicy: QuotaPolicy;
  tpsLimit: number;
  periodStart: string;
  periodEnd: string;
  renewalDate: string;
  channels: { channel: Channel; used: number; limit: number }[];
  applications: { applicationId: string; applicationName: string; channels: { channel: Channel; used: number }[] }[];
}

export interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  tenants: TenantUsageSummary[];
  channels: { channel: Channel; used: number; limit: number }[];
  planOptions: string[];
  tenantTable: Paginated<TenantUsageTableRow>;
}

export type TenantUsageSortField = "tenantName" | "usagePercent" | "used" | "remaining";

export interface TenantUsageTableQuery {
  page?: number;
  pageSize?: 10 | 20 | 50;
  search?: string;
  plan?: string;
  status?: UsageQuotaStatus | "all";
  quotaPolicy?: QuotaPolicy | "all";
  sortBy?: TenantUsageSortField;
  sortDirection?: "asc" | "desc";
}

export interface TenantUsageTableRow {
  tenantId: string;
  tenantName: string;
  plan: string;
  used: number;
  limit: number;
  remaining: number;
  usagePercent: number;
  status: UsageQuotaStatus;
  quotaPolicy: QuotaPolicy;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  channel?: Channel | "all";
  tenantId?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ListSortDirection = "asc" | "desc";

export interface ListQuery<Filters extends object = Record<string, never>, SortField extends string = string> {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: Filters;
  sortBy?: SortField;
  sortDirection?: ListSortDirection;
}

export type TenantSortField = "name" | "plan" | "status" | "quotaPct";
export type TenantListQuery = ListQuery<{ status?: Tenant["status"] | "all" }, TenantSortField>;

export type TemplateSortField = "name" | "channel" | "status" | "updatedAt";
export type TemplateListQuery = ListQuery<{
  channel?: Channel | "all";
  status?: TemplateStatus | "all";
  tenantId?: string;
}, TemplateSortField>;

export type PlatformApiClientSortField = "clientId" | "tenantName" | "status" | "lastUsedAt";
export type PlatformApiClientListQuery = ListQuery<{ status?: PlatformApiClient["status"] | "all"; tenantId?: string }, PlatformApiClientSortField>;

export type UserSortField = "name" | "email" | "tenantName" | "status" | "createdAt";
export type UserListQuery = ListQuery<{ status?: PortalUser["status"] | "all"; tenantId?: string }, UserSortField>;

export type ApplicationSortField = "name" | "status" | "createdAt" | "updatedAt" | "lastActivityAt";
export type ApplicationListQuery = ListQuery<{ status?: Application["status"] | "all"; tenantId?: string }, ApplicationSortField>;

export type ApiCredentialSortField = "clientId" | "applicationName" | "status" | "lastUsedAt" | "createdAt";
export type ApiCredentialListQuery = ListQuery<{
  applicationId?: string;
  tenantId?: string;
  status?: ApiCredential["status"] | "all";
}, ApiCredentialSortField>;

export type BulkJobSortField = "createdAt" | "status" | "progress";
export type BulkJobListQuery = ListQuery<{
  tenantId?: string;
  channel?: Channel | "all";
  status?: BulkJob["status"] | "all";
}, BulkJobSortField>;

export type SenderIdentitySortField = "tenantName" | "channel" | "verificationStatus" | "createdAt" | "updatedAt";
export type SenderIdentityListQuery = ListQuery<{
  tenantId?: string;
  channel?: Channel | "all";
  verificationStatus?: SenderIdentityVerificationStatus | "all";
  operationalStatus?: SenderIdentityOperationalStatus | "all";
}, SenderIdentitySortField>;

export interface SendMessageInput {
  channel: Channel;
  applicationId: string;
  senderIdentityId: string;
  recipient: string;
  templateId: string | null;
  subject?: string;
  body: string;
  idempotencyKey: string;
}

export interface BulkJob {
  id: string;
  tenantId?: string;
  tenantName?: string;
  applicationId?: string;
  senderIdentityId?: string;
  senderIdentityName?: string;
  templateId?: string | null;
  name: string;
  channel: Channel;
  applicationName: string;
  templateName: string | null;
  status: "scheduled" | "queued" | "processing" | "completed" | "partial" | "failed";
  total: number;
  valid?: number;
  duplicates?: number;
  suppressed?: number;
  sent?: number;
  delivered: number;
  failed: number;
  pending?: number;
  rejected?: number;
  estimatedUsage?: number;
  estimatedSegments?: number;
  actualUsage?: number | null;
  results?: BulkRecipientResult[];
  createdAt: string;
  createdBy: string;
}
export interface BulkRecipient {
  recipient: string;
  variables: Record<string, string>;
}
export interface BulkRecipientResult {
  recipient: string;
  status: "delivered" | "failed" | "rejected";
  errorMessage: string | null;
}
export interface CreateBulkJobInput {
  name: string;
  channel: Channel;
  applicationId: string;
  senderIdentityId: string;
  templateId: string | null;
  recipients: number;
  estimatedUsage?: number;
  estimatedSegments?: number;
  duplicates?: number;
  suppressed?: number;
  recipientRows?: BulkRecipient[];
  idempotencyKey: string;
}
export interface BulkSuppressionCandidate {
  rowNumber: number;
  recipient: string;
}

export type WebhookEvent = "message.sent" | "message.delivered" | "message.failed" | "message.read" | "bulk_job.completed" | "template.status_changed";
export interface Webhook {
  id: string;
  url: string;
  applicationName: string;
  events: WebhookEvent[];
  status: "active" | "disabled";
  signingConfigured: boolean;
  lastDeliveryAt: string | null;
  successRate: number;
  deliveries: WebhookDelivery[];
}
export interface WebhookDelivery {
  id: string;
  event: WebhookEvent;
  at: string;
  result: "success" | "failure";
  statusCode: number;
  attempt: number;
}

export interface PortalUser {
  id: string;
  tenantId: string | null;
  tenantName?: string | null;
  name: string;
  firstName?: string;
  lastName?: string;
  firstNameArabic?: string | null;
  lastNameArabic?: string | null;
  email: string;
  mobileNumber?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  preferredLanguage?: "en" | "ar";
  role: "super_admin" | "client_admin" | "operator" | "viewer";
  status: "active" | "invited" | "suspended" | "disabled" | "pending_activation";
  mfa?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type TenantUserRole = Exclude<PortalUser["role"], "super_admin">;

export interface CreatePortalUserInput {
  email: string;
  firstName: string;
  lastName: string;
  firstNameArabic?: string | null;
  lastNameArabic?: string | null;
  mobileNumber?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  preferredLanguage: "en" | "ar";
  role: TenantUserRole;
}

export interface UpdatePortalUserProfileInput {
  firstName: string;
  lastName: string;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  mobileNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  preferredLanguage: "en" | "ar";
}

export type UserStatus = "active" | "invited" | "suspended" | "disabled";

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
  trend: TrendPoint[];
}

export type PlanFeatureKey = "api_access" | "bulk_messaging" | "webhooks" | "reporting" | "audit_export" | "dedicated_sender_identities";

export interface PlanListQuery {
  page?: number;
  pageSize?: number;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  status: "active" | "draft" | "inactive" | "archived";
  tpsLimit: number;
  /** Present for the mock catalog. The live plan list does not include a subscriber count. */
  tenants: number | null;
  entitlements: { channel: Channel; enabled: boolean; monthly: number | null }[];
  quotaPolicy: QuotaPolicy;
  features: PlanFeatureKey[];
}

export interface ChannelConfig {
  channel: Channel;
  enabled: boolean;
  providers: number;
  tenants: number;
  senderIds: number;
  volume30d: number;
}

export type RoutingCategory = "authentication" | "transactional" | "marketing";

export type RoutingCondition =
  | { mode: "all" }
  | { mode: "categories"; categories: RoutingCategory[] };

export interface RetryPolicy {
  attempts: number;
  intervalSeconds: number;
}

export type FailoverTrigger =
  | "connection_timeout"
  | "network_error"
  | "http_5xx"
  | "provider_unavailable"
  | "rate_limited";

export interface RoutingRule {
  id: string;
  name: string;
  channel: Channel;
  priority: number;
  condition: RoutingCondition;
  primaryProvider: string;
  failoverProvider: string | null;
  retryPolicy: RetryPolicy;
  failoverTriggers: FailoverTrigger[];
  status: "active" | "disabled";
}

export interface PlatformApiClient {
  id: string;
  tenantId: string;
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
