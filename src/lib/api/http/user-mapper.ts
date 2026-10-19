import type {
  CreatePortalUserInput,
  Paginated,
  PortalUser,
  UpdatePortalUserProfileInput,
  UserListQuery,
  UserStatus,
} from "../types.ts";
import { isIsoTimestamp, isTenantUuid } from "./tenant-mapper.ts";

const USER_ROLES = {
  PLATFORM_SUPER_ADMIN: "super_admin",
  CLIENT_ADMIN: "client_admin",
  OPERATOR: "operator",
  VIEWER: "viewer",
} as const satisfies Record<string, PortalUser["role"]>;

const USER_STATUSES = {
  INVITED: "invited",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  DISABLED: "disabled",
} as const satisfies Record<string, UserStatus>;

const CREATE_ROLES = {
  client_admin: "CLIENT_ADMIN",
  operator: "OPERATOR",
  viewer: "VIEWER",
} as const satisfies Record<CreatePortalUserInput["role"], keyof typeof USER_ROLES>;

const STATUS_REQUESTS = {
  active: "ACTIVE",
  invited: "INVITED",
  suspended: "SUSPENDED",
  disabled: "DISABLED",
} as const satisfies Record<UserStatus, keyof typeof USER_STATUSES>;

export class UserApiMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserApiMappingError";
  }
}

export function userListPath(
  actorRole: string,
  query: UserListQuery,
  targetTenantId?: string,
): string {
  if (
    query.sortBy === "tenantName" &&
    (actorRole !== "super_admin" || targetTenantId !== undefined)
  ) {
    throw new UserApiMappingError(
      "Tenant-name sorting is only available in the global platform directory.",
    );
  }
  let path: string;
  if (actorRole === "super_admin" && targetTenantId !== undefined) {
    if (!isTenantUuid(targetTenantId)) {
      throw new UserApiMappingError("The requested tenant ID is invalid.");
    }
    path = `/tenants/${encodeURIComponent(targetTenantId)}/users`;
  } else if (actorRole === "super_admin") {
    path = "/platform/users";
  } else {
    path = "/users";
  }
  const params = new URLSearchParams({
    page: String(positiveInteger(query.page, 1)),
    pageSize: String(Math.min(100, positiveInteger(query.pageSize, 20))),
  });
  const search = query.search?.trim();
  const status = query.filters?.status;
  if (search) params.set("search", search);
  if (status && status !== "all") params.set("status", status.toUpperCase());
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDirection) params.set("sortDirection", query.sortDirection);
  return `${path}?${params.toString()}`;
}

export function userCreatePath(actorRole: string, targetTenantId?: string): string {
  if (actorRole !== "super_admin") return "/users";
  if (!targetTenantId || !isTenantUuid(targetTenantId)) {
    throw new UserApiMappingError("A valid tenant must be selected.");
  }
  return `/tenants/${encodeURIComponent(targetTenantId)}/users`;
}

export function userItemPath(actorRole: string, userId: string, targetTenantId?: string): string {
  if (!isTenantUuid(userId)) throw new UserApiMappingError("The user ID is invalid.");
  if (actorRole === "super_admin" && targetTenantId === undefined) {
    throw new UserApiMappingError("A tenant must be selected to manage this user.");
  }
  const base =
    actorRole === "super_admin"
      ? `${userCreatePath(actorRole, targetTenantId)}/${encodeURIComponent(userId)}`
      : `/users/${encodeURIComponent(userId)}`;
  return base;
}

export function mapUserPage(body: unknown): Paginated<PortalUser> {
  if (!isRecord(body) || !Array.isArray(body["items"])) {
    throw new UserApiMappingError("The user page response is malformed.");
  }
  const page = positiveInteger(body["page"], 0);
  const pageSize = positiveInteger(body["pageSize"], 0);
  const total = nonNegativeInteger(body["total"]);
  if (page < 1 || pageSize < 1 || pageSize > 100) {
    throw new UserApiMappingError("The user page metadata is invalid.");
  }
  const items = body["items"].map(mapUserResponse);
  const expectedCount = Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize));
  if (items.length !== expectedCount) {
    throw new UserApiMappingError("The user page is incomplete.");
  }
  const ids = new Set(items.map((user) => user.id));
  if (ids.size !== items.length) {
    throw new UserApiMappingError("The user page contains duplicate users.");
  }
  return { items, page, pageSize, total };
}

export function mapUserResponse(body: unknown): PortalUser {
  if (!isRecord(body)) throw new UserApiMappingError("The user response is malformed.");
  const id = text(body["id"], "id");
  if (!isTenantUuid(id)) throw new UserApiMappingError("The user ID is invalid.");
  const roleCode = text(body["role"], "role");
  const role = USER_ROLES[roleCode as keyof typeof USER_ROLES];
  if (!role) throw new UserApiMappingError("The user role is unknown.");
  const statusCode = text(body["status"], "status");
  const status = USER_STATUSES[statusCode as keyof typeof USER_STATUSES];
  if (!status) throw new UserApiMappingError("The user status is unknown.");
  const language = text(body["preferredLanguage"], "preferredLanguage");
  if (language !== "EN" && language !== "AR") {
    throw new UserApiMappingError("The user language is unknown.");
  }
  const tenantId = nullableText(body["tenantId"], "tenantId");
  if (tenantId !== null && !isTenantUuid(tenantId)) {
    throw new UserApiMappingError("The user tenant ID is invalid.");
  }
  const createdAt = timestamp(body["createdAt"], "createdAt");
  const updatedAt = timestamp(body["updatedAt"], "updatedAt");
  const tenantName =
    body["tenantName"] === undefined ? undefined : nullableText(body["tenantName"], "tenantName");

  return {
    id,
    tenantId,
    ...(tenantName === undefined ? {} : { tenantName }),
    firstName: text(body["firstName"], "firstName"),
    lastName: text(body["lastName"], "lastName"),
    name: `${text(body["firstName"], "firstName")} ${text(body["lastName"], "lastName")}`,
    firstNameArabic: nullableText(body["firstNameAr"], "firstNameAr"),
    lastNameArabic: nullableText(body["lastNameAr"], "lastNameAr"),
    email: text(body["email"], "email"),
    mobileNumber: nullableText(body["mobile"], "mobile"),
    jobTitle: nullableText(body["jobTitle"], "jobTitle"),
    department: nullableText(body["department"], "department"),
    preferredLanguage: language === "EN" ? "en" : "ar",
    role,
    status,
    createdAt,
    updatedAt,
  };
}

export function toCreateUserRequest(input: CreatePortalUserInput): Record<string, unknown> {
  return {
    email: input.email.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    ...(input.firstNameArabic === undefined ? {} : { firstNameAr: input.firstNameArabic }),
    ...(input.lastNameArabic === undefined ? {} : { lastNameAr: input.lastNameArabic }),
    ...(input.mobileNumber === undefined ? {} : { mobile: input.mobileNumber }),
    ...(input.jobTitle === undefined ? {} : { jobTitle: input.jobTitle }),
    ...(input.department === undefined ? {} : { department: input.department }),
    preferredLanguage: input.preferredLanguage === "en" ? "EN" : "AR",
    role: CREATE_ROLES[input.role],
  };
}

export function toUpdateUserProfileRequest(
  input: UpdatePortalUserProfileInput,
): Record<string, unknown> {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    firstNameAr: input.firstNameArabic,
    lastNameAr: input.lastNameArabic,
    mobile: input.mobileNumber,
    jobTitle: input.jobTitle,
    department: input.department,
    preferredLanguage: input.preferredLanguage === "en" ? "EN" : "AR",
  };
}

export function toUserRoleRequest(role: CreatePortalUserInput["role"]): { role: string } {
  return { role: CREATE_ROLES[role] };
}

export function toUserStatusRequest(status: UserStatus): { status: string } {
  return { status: STATUS_REQUESTS[status] };
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new UserApiMappingError("The user total is invalid.");
  }
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new UserApiMappingError(`The user ${field} is invalid.`);
  }
  return value;
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null) return null;
  return text(value, field);
}

function timestamp(value: unknown, field: string): string {
  if (!isIsoTimestamp(value)) {
    throw new UserApiMappingError(`The user ${field} is invalid.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
