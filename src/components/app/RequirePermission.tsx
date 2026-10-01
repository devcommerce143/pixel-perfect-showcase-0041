import type { ReactNode } from "react";
import type { Permission } from "@/lib/auth/permissions";
import { useSession } from "@/lib/auth/session";
import { ForbiddenState } from "./States";

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useSession();
  return can(permission) ? <>{children}</> : <ForbiddenState />;
}
