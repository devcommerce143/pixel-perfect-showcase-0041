import type {
  Application,
  ApplicationChannelAvailability,
  Channel,
  Paginated,
  PlatformApplication,
  ApplicationListQuery,
  Role,
} from "../types.ts";

const CHANNELS = {
  SMS: "sms",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
} as const satisfies Record<string, Channel>;

const ENVIRONMENTS = {
  PRODUCTION: "production",
  SANDBOX: "sandbox",
} as const satisfies Record<string, Application["environment"]>;

const STATUSES = {
  ACTIVE: "active",
  DISABLED: "disabled",
} as const satisfies Record<string, Application["status"]>;

const SCOPES: Record<string, string> = {
  MESSAGES_SEND: "messages:send",
  MESSAGES_READ: "messages:read",
  TEMPLATES_READ: "templates:read",
  WEBHOOKS_MANAGE: "webhooks:manage",
};

const SENDER_ACCESS = {
  ALL_ELIGIBLE: "all_eligible",
  ALLOW_LIST: "allow_list",
} as const satisfies Record<string, NonNullable<Application["senderAccess"]>>;

export class ApplicationResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationResponseError";
  }
}

export class ApplicationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationRequestError";
  }
}

export function applicationListPath(
  role: Role,
  page: number,
  pageSize: number,
  tenantId?: string,
  query?: ApplicationListQuery,
): string {
  assertPagination(page, pageSize);
  const base =
    role === "super_admin"
      ? `/tenants/${encodeURIComponent(requireTenantId(tenantId))}/applications`
      : "/applications";
  return `${base}?${applicationQueryString(page, pageSize, query)}`;
}

export function platformApplicationListPath(
  page: number,
  pageSize: number,
  query?: ApplicationListQuery,
): string {
  assertPagination(page, pageSize);
  return `/platform/applications?${applicationQueryString(page, pageSize, query)}`;
}

function applicationQueryString(page: number, pageSize: number, query?: ApplicationListQuery) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (query?.search !== undefined) {
    if (typeof query.search !== "string" || query.search.length > 120)
      throw new ApplicationRequestError("Invalid application search");
    if (query.search.trim()) params.set("search", query.search.trim());
  }
  const status = query?.filters?.status;
  if (status && status !== "all") {
    if (!Object.hasOwn(STATUSES, status.toUpperCase()))
      throw new ApplicationRequestError("Invalid application status");
    params.set("status", status.toUpperCase());
  }
  if (query?.sortBy !== undefined || query?.sortDirection !== undefined) {
    const field = query.sortBy ?? "name",
      direction = query.sortDirection ?? "asc";
    if (
      !["name", "status", "createdAt", "updatedAt"].includes(field) ||
      !["asc", "desc"].includes(direction)
    )
      throw new ApplicationRequestError("Invalid application ordering");
    params.set("sortBy", field);
    params.set("sortDirection", direction);
  }
  return params.toString();
}

export function applicationDetailPath(
  role: Role,
  applicationId: string,
  tenantId?: string,
): string {
  if (!applicationId.trim()) {
    throw new ApplicationRequestError("Application ID is required.");
  }
  const base = role === "super_admin"
    ? `/tenants/${encodeURIComponent(requireTenantId(tenantId))}/applications`
    : "/applications";
  return `${base}/${encodeURIComponent(applicationId)}`;
}

export function mapApplicationPage(value: unknown): Paginated<Application> {
  const response = record(value, "Application page");
  if (!Array.isArray(response["items"])) {
    throw new ApplicationResponseError("Application page items are invalid.");
  }
  const page = integer(response["page"], "page", 1);
  const pageSize = integer(response["pageSize"], "pageSize", 1);
  const total = integer(response["total"], "total", 0);
  return {
    items: response["items"].map(mapApplication),
    page,
    pageSize,
    total,
  };
}

export function mapPlatformApplicationPage(
  value: unknown,
): Paginated<PlatformApplication> {
  const response = record(value, "Platform application page");
  if (!Array.isArray(response["items"])) {
    throw new ApplicationResponseError(
      "Platform application page items are invalid.",
    );
  }
  return {
    items: response["items"].map((value) => {
      const item = record(value, "Platform application");
      const tenantName = string(item["tenantName"], "tenantName");
      if (!tenantName.trim()) {
        throw new ApplicationResponseError(
          "Platform application tenantName is invalid.",
        );
      }
      return { ...mapApplication(item), tenantName };
    }),
    page: integer(response["page"], "page", 1),
    pageSize: integer(response["pageSize"], "pageSize", 1),
    total: integer(response["total"], "total", 0),
  };
}

export function mapApplication(value: unknown): Application {
  const response = record(value, "Application");
  const channels = array(response["channels"], "channels").map((channel) =>
    enumValue(CHANNELS, channel, "channel"),
  );
  const scopes = array(response["scopes"], "scopes").map((scope) =>
    enumValue(SCOPES, scope, "scope"),
  );
  const allowListSenderIds = array(response["allowListSenderIds"], "allowListSenderIds")
    .map((id) => string(id, "allowListSenderIds item"));
  const channelAvailability = array(response["channelAvailability"], "channelAvailability")
    .map(mapChannelAvailability);
  return {
    id: string(response["id"], "id"),
    tenantId: string(response["tenantId"], "tenantId"),
    name: string(response["name"], "name"),
    environment: enumValue(ENVIRONMENTS, response["environment"], "environment"),
    status: enumValue(STATUSES, response["status"], "status"),
    channels,
    scopes,
    senderAccess: enumValue(SENDER_ACCESS, response["senderAccess"], "senderAccess"),
    allowListSenderIds,
    channelAvailability,
    createdAt: string(response["createdAt"], "createdAt"),
    updatedAt: string(response["updatedAt"], "updatedAt"),
  };
}

function mapChannelAvailability(value: unknown): ApplicationChannelAvailability {
  const item = record(value, "Channel availability");
  if (typeof item["granted"] !== "boolean" || typeof item["available"] !== "boolean") {
    throw new ApplicationResponseError("Application channel availability is invalid.");
  }
  return {
    channel: enumValue(CHANNELS, item["channel"], "channel"),
    granted: item["granted"],
    available: item["available"],
  };
}

function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId) {
    throw new ApplicationRequestError(
      "Select a tenant before loading platform applications.",
    );
  }
  return tenantId;
}

function assertPagination(page: number, pageSize: number): void {
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger((page - 1) * pageSize) ||
    (page - 1) * pageSize > 2147483647
  ) {
    throw new ApplicationRequestError("Application page must be a positive integer.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ApplicationRequestError(
      "Application page size must be between 1 and 100.",
    );
  }
}

function enumValue<const Values extends Record<string, string>>(
  values: Values,
  value: unknown,
  field: string,
): Values[keyof Values] {
  if (typeof value !== "string" || !Object.hasOwn(values, value)) {
    throw new ApplicationResponseError(`Application ${field} is invalid.`);
  }
  return values[value as keyof Values];
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ApplicationResponseError(`Application ${field} is invalid.`);
  }
  return value;
}

function integer(value: unknown, field: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new ApplicationResponseError(`Application ${field} is invalid.`);
  }
  return value;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ApplicationResponseError(`Application ${field} is invalid.`);
  }
  return value;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApplicationResponseError(`${field} response is invalid.`);
  }
  return value as Record<string, unknown>;
}
