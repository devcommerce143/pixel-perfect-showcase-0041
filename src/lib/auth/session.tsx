import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { roleHas, type Permission, type Role } from "./permissions";

/**
 * Session abstraction. In production this is backed by Keycloak (OAuth 2.0 / OIDC):
 * the access token's claims provide the user, tenant and roles. During development
 * the session is simulated so every role can be exercised.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
}

const DEV_USERS: Record<Role, SessionUser> = {
  super_admin: {
    id: "usr-0001",
    name: "Khalid Al-Mutairi",
    email: "k.almutairi@dolftech.example",
    role: "super_admin",
    tenantId: null,
    tenantName: null,
  },
  client_admin: {
    id: "usr-0142",
    name: "Noura Al-Qahtani",
    email: "n.alqahtani@alnoor-fs.example",
    role: "client_admin",
    tenantId: "TEN-00012",
    tenantName: "Al Noor Financial Services",
  },
  operator: {
    id: "usr-0157",
    name: "Faisal Al-Harbi",
    email: "f.alharbi@alnoor-fs.example",
    role: "operator",
    tenantId: "TEN-00012",
    tenantName: "Al Noor Financial Services",
  },
  viewer: {
    id: "usr-0163",
    name: "Reem Al-Dosari",
    email: "r.aldosari@alnoor-fs.example",
    role: "viewer",
    tenantId: "TEN-00012",
    tenantName: "Al Noor Financial Services",
  },
};

interface SessionContextValue {
  user: SessionUser;
  isPlatform: boolean;
  can: (permission: Permission) => boolean;
  /** Development only: switch the simulated role. */
  setDevRole: (role: Role) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);
const STORAGE_KEY = "dc.devRole";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("client_admin");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Role | null;
    if (stored && stored in DEV_USERS) setRole(stored);
  }, []);

  const setDevRole = useCallback((next: Role) => {
    setRole(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user: DEV_USERS[role],
      isPlatform: role === "super_admin",
      can: (p) => roleHas(role, p),
      setDevRole,
    }),
    [role, setDevRole],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
