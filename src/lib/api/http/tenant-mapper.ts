import type {
  Paginated,
  TenantCatalogItem,
  TenantCreateRequest,
  TenantCreateResponse,
  TenantCreatedPrimaryAdmin,
  TenantDetail,
  TenantProfileUpdateInput,
  TenantProfileUpdateRequest,
  TenantStatus,
  TenantUpsertInput,
} from "../types.ts";

const TENANT_STATUSES = {
  TRIAL: "trial",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  INACTIVE: "inactive",
} as const satisfies Record<string, TenantCatalogItem["status"]>;

const TENANT_STATUS_REQUESTS = {
  trial: "TRIAL",
  active: "ACTIVE",
  suspended: "SUSPENDED",
  inactive: "INACTIVE",
} as const satisfies Record<TenantStatus, keyof typeof TENANT_STATUSES>;

export class TenantCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantCatalogError";
  }
}

export function tenantListPath(page?: number, pageSize?: number): string {
  const normalizedPage = Number.isSafeInteger(page) && page! > 0 ? page! : 1;
  const normalizedPageSize = Number.isSafeInteger(pageSize) && pageSize! > 0
    ? Math.min(pageSize!, 100)
    : 20;
  return `/tenants?${new URLSearchParams({
    page: String(normalizedPage),
    pageSize: String(normalizedPageSize),
  }).toString()}`;
}

export function tenantDetailPath(tenantId: string): string {
  return `/tenants/${encodeURIComponent(tenantId)}`;
}

export function tenantStatusPath(tenantId: string): string {
  if (!isTenantUuid(tenantId)) {
    throw new TenantCatalogError("Tenant ID must be a UUID.");
  }
  return `${tenantDetailPath(tenantId)}/status`;
}

export function toTenantStatusRequest(status: TenantStatus): { status: keyof typeof TENANT_STATUSES } {
  return { status: TENANT_STATUS_REQUESTS[status] };
}

const CREATE_STATUSES = {
  trial: "TRIAL",
  active: "ACTIVE",
  suspended: "SUSPENDED",
  inactive: "INACTIVE",
} as const satisfies Record<TenantUpsertInput["status"], NonNullable<TenantCreateRequest["status"]>>;

const CREATE_LANGUAGES = {
  en: "EN",
  ar: "AR",
} as const satisfies Record<TenantUpsertInput["defaultLanguage"], NonNullable<TenantCreateRequest["defaultLanguage"]>>;

const PROFILE_LANGUAGES = {
  en: "EN",
  ar: "AR",
} as const satisfies Record<NonNullable<TenantProfileUpdateInput["defaultLanguage"]>, NonNullable<TenantProfileUpdateRequest["defaultLanguage"]>>;

export class TenantProfileRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantProfileRequestError";
  }
}

export function toTenantProfileUpdateRequest(input: TenantProfileUpdateInput): TenantProfileUpdateRequest {
  const request: TenantProfileUpdateRequest = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 200) {
      throw new TenantProfileRequestError("Tenant name is invalid.");
    }
    request.name = name;
  }
  if (input.notes !== undefined) {
    const notes = input.notes?.trim() ?? "";
    if (notes.length > 4000) throw new TenantProfileRequestError("Tenant notes are too long.");
    request.notes = notes || null;
  }
  if (input.defaultLanguage !== undefined) {
    const language = PROFILE_LANGUAGES[input.defaultLanguage];
    if (!language) throw new TenantProfileRequestError("Tenant language is unknown.");
    request.defaultLanguage = language;
  }
  if (input.timezone !== undefined) {
    const timezone = input.timezone.trim();
    if (!timezone || timezone.length > 64) {
      throw new TenantProfileRequestError("Tenant time zone is invalid.");
    }
    request.timezone = timezone;
  }
  if (Object.keys(request).length === 0) {
    throw new TenantProfileRequestError("At least one tenant profile field is required.");
  }
  return request;
}

export function toTenantCreateRequest(input: TenantUpsertInput): TenantCreateRequest {
  const primaryAdmin = input.primaryAdministrator;
  return {
    code: input.code,
    name: input.name,
    dataRegion: input.dataRegion,
    status: CREATE_STATUSES[input.status],
    defaultLanguage: CREATE_LANGUAGES[input.defaultLanguage],
    timezone: input.timezone,
    ...(input.notes ? { notes: input.notes } : {}),
    ...(primaryAdmin ? {
      primaryAdmin: {
        email: primaryAdmin.email,
        firstName: primaryAdmin.firstName,
        lastName: primaryAdmin.lastName,
        ...(primaryAdmin.firstNameArabic ? { firstNameAr: primaryAdmin.firstNameArabic } : {}),
        ...(primaryAdmin.lastNameArabic ? { lastNameAr: primaryAdmin.lastNameArabic } : {}),
        ...(primaryAdmin.mobileNumber ? { mobile: primaryAdmin.mobileNumber } : {}),
        preferredLanguage: CREATE_LANGUAGES[primaryAdmin.preferredLanguage],
      },
    } : {}),
  };
}

export function mapTenantCreateResponse(body: unknown): TenantCreateResponse {
  if (!isRecord(body)) throw new TenantCatalogError("Tenant create response must be an object.");
  if (!("tenant" in body) || !("primaryAdmin" in body)) {
    throw new TenantCatalogError("Tenant create response must include tenant and primaryAdmin.");
  }
  const tenant = mapTenantResponse(body["tenant"]);
  const primaryAdmin = body["primaryAdmin"] === null
    ? null
    : readCreatedPrimaryAdmin(body["primaryAdmin"], tenant.id);
  if ((tenant.primaryAdminUserId ?? null) !== (primaryAdmin?.id ?? null)) {
    throw new TenantCatalogError("Tenant create response administrator reference is inconsistent.");
  }
  return { tenant, primaryAdmin };
}

function readCreatedPrimaryAdmin(value: unknown, tenantId: string): TenantCreatedPrimaryAdmin {
  if (!isRecord(value)) throw new TenantCatalogError("Tenant create primaryAdmin must be an object or null.");
  const id = text(value["id"], "primaryAdmin.id");
  if (!isTenantUuid(id)) throw new TenantCatalogError("primaryAdmin.id must be a UUID.");
  const responseTenantId = nullableText(value["tenantId"], "primaryAdmin.tenantId");
  if (responseTenantId !== tenantId) {
    throw new TenantCatalogError("primaryAdmin belongs to a different tenant.");
  }
  const language = text(value["preferredLanguage"], "primaryAdmin.preferredLanguage");
  if (language !== "EN" && language !== "AR") {
    throw new TenantCatalogError("primaryAdmin.preferredLanguage is unknown.");
  }
  const roleText = text(value["role"], "primaryAdmin.role");
  const roles = {
    PLATFORM_SUPER_ADMIN: "platform_super_admin",
    CLIENT_ADMIN: "client_admin",
    OPERATOR: "operator",
    VIEWER: "viewer",
  } as const;
  const role = roles[roleText as keyof typeof roles];
  if (!role) throw new TenantCatalogError("primaryAdmin.role is unknown.");
  const statusText = text(value["status"], "primaryAdmin.status");
  const statuses = {
    INVITED: "invited",
    ACTIVE: "active",
    SUSPENDED: "suspended",
    DISABLED: "disabled",
  } as const;
  const status = statuses[statusText as keyof typeof statuses];
  if (!status) throw new TenantCatalogError("primaryAdmin.status is unknown.");
  if (role !== "client_admin" || status !== "invited") {
    throw new TenantCatalogError("Created primaryAdmin must be an invited client administrator.");
  }
  return {
    id,
    tenantId: responseTenantId,
    email: text(value["email"], "primaryAdmin.email"),
    firstName: text(value["firstName"], "primaryAdmin.firstName"),
    lastName: text(value["lastName"], "primaryAdmin.lastName"),
    firstNameAr: nullableString(value["firstNameAr"], "primaryAdmin.firstNameAr"),
    lastNameAr: nullableString(value["lastNameAr"], "primaryAdmin.lastNameAr"),
    mobile: nullableString(value["mobile"], "primaryAdmin.mobile"),
    jobTitle: nullableString(value["jobTitle"], "primaryAdmin.jobTitle"),
    department: nullableString(value["department"], "primaryAdmin.department"),
    preferredLanguage: language === "EN" ? "en" : "ar",
    role,
    status,
    createdAt: timestamp(value["createdAt"], "primaryAdmin.createdAt"),
    updatedAt: timestamp(value["updatedAt"], "primaryAdmin.updatedAt"),
  };
}

export function isTenantUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/i.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const second = Number(parts[6]);
  const offsetHour = Number(parts[7] ?? 0);
  const offsetMinute = Number(parts[8] ?? 0);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return Boolean(
    month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]! &&
    hour <= 23 && minute <= 59 && second <= 59 && offsetHour <= 23 && offsetMinute <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

export function mapTenantPage(body: unknown): Paginated<TenantCatalogItem> {
  if (!isRecord(body)) throw new TenantCatalogError("Tenant catalog response must be an object.");
  if (!Array.isArray(body["items"])) throw new TenantCatalogError("Tenant catalog items must be an array.");
  const page = integer(body["page"], "page", 1);
  const pageSize = integer(body["pageSize"], "pageSize", 1);
  if (pageSize > 100) throw new TenantCatalogError("Tenant catalog pageSize cannot exceed 100.");
  const total = integer(body["total"], "total", 0);
  return {
    items: body["items"].map((item, index) => readTenant(item, `tenants[${index}]`)),
    page,
    pageSize,
    total,
  };
}

export function mapTenantResponse(body: unknown): TenantDetail {
  return readTenant(body, "tenant");
}

function readTenant(value: unknown, fieldPrefix: string): TenantDetail {
  if (!isRecord(value)) throw new TenantCatalogError(`${fieldPrefix} must be an object.`);
  const id = text(value["id"], `${fieldPrefix}.id`);
  if (!isTenantUuid(id)) throw new TenantCatalogError(`${fieldPrefix}.id must be a UUID.`);
  const rawStatus = text(value["status"], `${fieldPrefix}.status`);
  const status = TENANT_STATUSES[rawStatus as keyof typeof TENANT_STATUSES];
  if (!status) throw new TenantCatalogError(`${fieldPrefix} has an unknown status.`);
  const language = text(value["defaultLanguage"], `${fieldPrefix}.defaultLanguage`);
  if (language !== "EN" && language !== "AR") {
    throw new TenantCatalogError(`${fieldPrefix} has an unknown default language.`);
  }
  return {
    id,
    code: text(value["code"], `${fieldPrefix}.code`),
    name: text(value["name"], `${fieldPrefix}.name`),
    status,
    dataRegion: text(value["dataRegion"], `${fieldPrefix}.dataRegion`),
    defaultLanguage: language === "EN" ? "en" : "ar",
    timezone: text(value["timezone"], `${fieldPrefix}.timezone`),
    notes: nullableString(value["notes"], `${fieldPrefix}.notes`),
    primaryAdminUserId: nullableText(value["primaryAdminUserId"], `${fieldPrefix}.primaryAdminUserId`),
    createdAt: timestamp(value["createdAt"], `${fieldPrefix}.createdAt`),
    updatedAt: timestamp(value["updatedAt"], `${fieldPrefix}.updatedAt`),
  };
}

function integer(value: unknown, field: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new TenantCatalogError(`Tenant catalog ${field} must be an integer of at least ${minimum}.`);
  }
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TenantCatalogError(`${field} must be text.`);
  }
  return value;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field);
  if (!isIsoTimestamp(result)) throw new TenantCatalogError(`${field} must be a valid timestamp.`);
  return result;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function nullableText(value: unknown, field: string): string | null {
  return value === null ? null : text(value, field);
}

function nullableString(value: unknown, field: string): string | null {
  if (value !== null && typeof value !== "string") {
    throw new TenantCatalogError(`${field} must be text or null.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
