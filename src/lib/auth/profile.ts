import type { HumanHttpClient } from "../api/http/client.ts";
import { ApiError } from "../api/http/errors.ts";
import type { Role } from "./permissions.ts";
import type { SessionUser } from "./session-user.ts";

const ROLE_MAP: Record<string, Role> = {
  PLATFORM_SUPER_ADMIN: "super_admin",
  CLIENT_ADMIN: "client_admin",
  OPERATOR: "operator",
  VIEWER: "viewer",
};

const BLOCKED_STATUSES = new Set([
  "disabled",
  "inactive",
  "suspended",
  "revoked",
  "locked",
  "deleted",
]);

export type ProfileAccess =
  | { type: "authenticated"; user: SessionUser }
  | { type: "unauthenticated"; correlationId: string | null }
  | {
      type: "forbidden";
      correlationId: string | null;
      reason: "http" | "malformed" | "unknown_role" | "missing_tenant" | "disabled";
    }
  | { type: "error"; correlationId: string | null; message: string };

export function mapBackendProfile(body: unknown): SessionUser {
  if (!isRecord(body)) throw new ProfileRejectedError("malformed");
  const userId = body["userId"];
  const role = body["role"];
  const status = body["status"];
  const tenantId = body["tenantId"];

  if (typeof userId !== "string" || !userId.trim()) throw new ProfileRejectedError("malformed");
  if (typeof status !== "string" || !status.trim()) throw new ProfileRejectedError("malformed");
  if (typeof role !== "string") throw new ProfileRejectedError("unknown_role");
  const portalRole = ROLE_MAP[role];
  if (!portalRole) throw new ProfileRejectedError("unknown_role");
  if (BLOCKED_STATUSES.has(status.trim().toLowerCase())) throw new ProfileRejectedError("disabled");
  if (portalRole !== "super_admin" && (typeof tenantId !== "string" || !tenantId.trim())) {
    throw new ProfileRejectedError("missing_tenant");
  }

  return {
    id: userId.trim(),
    name: userId.trim(),
    email: "",
    role: portalRole,
    tenantId: portalRole === "super_admin" ? null : (tenantId as string).trim(),
    tenantName: null,
  };
}

export class ProfileRejectedError extends Error {
  readonly reason: "malformed" | "unknown_role" | "missing_tenant" | "disabled";

  constructor(reason: ProfileRejectedError["reason"]) {
    super(reason);
    this.name = "ProfileRejectedError";
    this.reason = reason;
  }
}

export async function loadAuthoritativeProfile(
  client: HumanHttpClient,
  signal?: AbortSignal,
): Promise<ProfileAccess> {
  try {
    const body = await client.get<unknown>("/auth/me", signal ? { signal } : {});
    return { type: "authenticated", user: mapBackendProfile(body) };
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      return { type: "unauthenticated", correlationId: error.correlationId };
    }
    if (error instanceof ApiError && error.statusCode === 403) {
      return { type: "forbidden", correlationId: error.correlationId, reason: "http" };
    }
    if (error instanceof ProfileRejectedError) {
      return { type: "forbidden", correlationId: null, reason: error.reason };
    }
    if (error instanceof ApiError) {
      return { type: "error", correlationId: error.correlationId, message: error.message };
    }
    return { type: "error", correlationId: null, message: "The profile request failed." };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
