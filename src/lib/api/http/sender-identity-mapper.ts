import type {
  Paginated,
  PlatformSenderIdentityRead,
  Role,
  SenderIdentityListQuery,
  SenderIdentityRead,
} from "../types.ts";
import { isTenantUuid } from "./tenant-mapper.ts";

const CHANNELS = {
  SMS: "sms",
  EMAIL: "email",
  WHATSAPP: "whatsapp",
} as const;

const VERIFICATION_STATUSES = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  PENDING_VERIFICATION: "pending_verification",
  VERIFIED: "verified",
  REJECTED: "rejected",
} as const;

const OPERATIONAL_STATUSES = {
  INACTIVE: "inactive",
  ACTIVE: "active",
  SUSPENDED: "suspended",
} as const;

const DOMAIN_CHECK_STATUSES = {
  NOT_CONFIGURED: "not_configured",
  PENDING: "pending",
  VERIFIED: "verified",
  FAILED: "failed",
} as const;

export class SenderIdentityRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SenderIdentityRequestError";
  }
}

export class SenderIdentityResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SenderIdentityResponseError";
  }
}

export function senderIdentityListPath(
  role: Role,
  page: number,
  pageSize: number,
  filters: SenderIdentityListQuery["filters"] = {},
  tenantId?: string,
): string {
  assertPagination(page, pageSize);
  const base =
    role === "super_admin"
      ? `/tenants/${encodeURIComponent(requireTenantId(tenantId))}/senders`
      : "/senders";
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (filters?.channel && filters.channel !== "all") {
    params.set("channel", filters.channel.toUpperCase());
  }
  if (filters?.verificationStatus && filters.verificationStatus !== "all") {
    params.set("verificationStatus", filters.verificationStatus.toUpperCase());
  }
  if (filters?.operationalStatus && filters.operationalStatus !== "all") {
    params.set("operationalStatus", filters.operationalStatus.toUpperCase());
  }
  return `${base}?${params.toString()}`;
}

export function platformSenderIdentityListPath(
  page: number,
  pageSize: number,
  filters: SenderIdentityListQuery["filters"] = {},
): string {
  assertPagination(page, pageSize);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (filters?.channel && filters.channel !== "all") {
    params.set("channel", filters.channel.toUpperCase());
  }
  if (filters?.verificationStatus && filters.verificationStatus !== "all") {
    params.set("verificationStatus", filters.verificationStatus.toUpperCase());
  }
  if (filters?.operationalStatus && filters.operationalStatus !== "all") {
    params.set("operationalStatus", filters.operationalStatus.toUpperCase());
  }
  if (filters?.tenantId) {
    if (!isTenantUuid(filters.tenantId)) {
      throw new SenderIdentityRequestError("Sender identity tenant ID is invalid.");
    }
    params.set("tenantId", filters.tenantId);
  }
  return `/platform/senders?${params.toString()}`;
}

export function senderIdentityDetailPath(role: Role, senderId: string, tenantId?: string): string {
  if (!isUuid(senderId)) {
    throw new SenderIdentityRequestError("Sender identity ID is invalid.");
  }
  const base =
    role === "super_admin"
      ? `/tenants/${encodeURIComponent(requireTenantId(tenantId))}/senders`
      : "/senders";
  return `${base}/${encodeURIComponent(senderId)}`;
}

export function mapSenderIdentityPage(value: unknown): Paginated<SenderIdentityRead> {
  const response = record(value, "Sender identity page");
  if (!Array.isArray(response["items"])) {
    throw new SenderIdentityResponseError("Sender identity page items are invalid.");
  }
  return {
    items: response["items"].map(mapSenderIdentity),
    page: integer(response["page"], "page", 1),
    pageSize: integer(response["pageSize"], "pageSize", 1, 100),
    total: integer(response["total"], "total", 0),
  };
}

export function mapPlatformSenderIdentityPage(
  value: unknown,
): Paginated<PlatformSenderIdentityRead> {
  const response = record(value, "Platform sender identity page");
  if (!Array.isArray(response["items"])) {
    throw new SenderIdentityResponseError("Platform sender identity page items are invalid.");
  }
  return {
    items: response["items"].map((item) => {
      const row = record(item, "Platform sender identity");
      const tenantName = string(row["tenantName"], "tenantName");
      if (!tenantName.trim()) {
        throw new SenderIdentityResponseError("Sender identity tenantName is invalid.");
      }
      return { ...mapSenderIdentity(row), tenantName };
    }),
    page: integer(response["page"], "page", 1),
    pageSize: integer(response["pageSize"], "pageSize", 1, 100),
    total: integer(response["total"], "total", 0),
  };
}

export function mapSenderIdentity(value: unknown): SenderIdentityRead {
  const response = record(value, "Sender identity");
  const common = {
    id: uuid(response["id"], "id"),
    tenantId: uuid(response["tenantId"], "tenantId"),
    displayName: nullableString(response["displayName"], "displayName"),
    verificationStatus: enumValue(
      VERIFICATION_STATUSES,
      response["verificationStatus"],
      "verificationStatus",
    ),
    operationalStatus: enumValue(
      OPERATIONAL_STATUSES,
      response["operationalStatus"],
      "operationalStatus",
    ),
    providerReference: nullableString(response["providerReference"], "providerReference"),
    rejectionReason: nullableString(response["rejectionReason"], "rejectionReason"),
    suspensionReason: nullableString(response["suspensionReason"], "suspensionReason"),
    createdAt: timestamp(response["createdAt"], "createdAt"),
    updatedAt: timestamp(response["updatedAt"], "updatedAt"),
  };
  const channel = enumValue(CHANNELS, response["channel"], "channel");

  if (channel === "sms") {
    const sms = nullableRecord(response["sms"], "sms");
    if (!sms) throw new SenderIdentityResponseError("SMS sender profile is missing.");
    return {
      ...common,
      channel,
      sms: {
        senderId: string(sms["senderId"], "sms.senderId"),
        countryCode: string(sms["countryCode"], "sms.countryCode"),
      },
    };
  }

  if (channel === "email") {
    const email = nullableRecord(response["email"], "email");
    if (!email) throw new SenderIdentityResponseError("Email sender profile is missing.");
    return {
      ...common,
      channel,
      email: {
        emailAddress: string(email["emailAddress"], "email.emailAddress"),
        domain: string(email["domain"], "email.domain"),
        domainVerificationStatus: enumValue(
          DOMAIN_CHECK_STATUSES,
          email["domainVerificationStatus"],
          "email.domainVerificationStatus",
        ),
        spfStatus: enumValue(DOMAIN_CHECK_STATUSES, email["spfStatus"], "email.spfStatus"),
        dkimStatus: enumValue(DOMAIN_CHECK_STATUSES, email["dkimStatus"], "email.dkimStatus"),
      },
    };
  }

  const whatsapp = nullableRecord(response["whatsapp"], "whatsapp");
  if (!whatsapp) throw new SenderIdentityResponseError("WhatsApp sender profile is missing.");
  return {
    ...common,
    channel,
    whatsapp: {
      businessDisplayName: string(whatsapp["businessDisplayName"], "whatsapp.businessDisplayName"),
      phoneNumber: string(whatsapp["phoneNumber"], "whatsapp.phoneNumber"),
      countryCode: string(whatsapp["countryCode"], "whatsapp.countryCode"),
      wabaId: string(whatsapp["wabaId"], "whatsapp.wabaId"),
      phoneNumberId: string(whatsapp["phoneNumberId"], "whatsapp.phoneNumberId"),
    },
  };
}

function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId || !isUuid(tenantId)) {
    throw new SenderIdentityRequestError("Select a valid tenant before loading sender identities.");
  }
  return tenantId;
}

function assertPagination(page: number, pageSize: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new SenderIdentityRequestError("Sender identity page must be positive.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new SenderIdentityRequestError("Sender identity page size must be between 1 and 100.");
  }
}

function enumValue<const Values extends Record<string, string>>(
  values: Values,
  value: unknown,
  field: string,
): Values[keyof Values] {
  if (typeof value !== "string" || !Object.hasOwn(values, value)) {
    throw new SenderIdentityResponseError(`Sender identity ${field} is invalid.`);
  }
  return values[value];
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SenderIdentityResponseError(`${field} response is invalid.`);
  }
  return value as Record<string, unknown>;
}

function nullableRecord(value: unknown, field: string): Record<string, unknown> | null {
  return value === null ? null : record(value, field);
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new SenderIdentityResponseError(`Sender identity ${field} is invalid.`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  return value === null ? null : string(value, field);
}

function timestamp(value: unknown, field: string): string {
  const result = string(value, field);
  if (!Number.isFinite(Date.parse(result))) {
    throw new SenderIdentityResponseError(`Sender identity ${field} is invalid.`);
  }
  return result;
}

function integer(
  value: unknown,
  field: string,
  minimum: number,
  maximum = Number.POSITIVE_INFINITY,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new SenderIdentityResponseError(`Sender identity ${field} is invalid.`);
  }
  return value;
}

function uuid(value: unknown, field: string): string {
  const result = string(value, field);
  if (!isUuid(result)) {
    throw new SenderIdentityResponseError(`Sender identity ${field} is invalid.`);
  }
  return result;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
