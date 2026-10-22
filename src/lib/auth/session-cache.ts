import type { SessionUser } from "./session-user.ts";
import type { SessionStatus } from "./session-context.tsx";

/** A profile change must invalidate even legacy query keys without actor identity. */
export function sessionCacheScope(
  mode: "mock" | "live",
  status: SessionStatus,
  user: SessionUser | null,
) {
  return JSON.stringify([
    mode,
    status,
    status === "authenticated" ? user?.id : null,
    status === "authenticated" ? user?.role : null,
    status === "authenticated" ? user?.tenantId : null,
  ]);
}
