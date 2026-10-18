import type { Role } from "./permissions.ts";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
}
