import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { roleHas, type Permission, type Role } from "./permissions";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
}

export interface DevelopmentAccount {
  user: SessionUser;
  password: string;
}

export const DEVELOPMENT_ACCOUNTS: DevelopmentAccount[] = [
  {
    user: { id: "usr-0001", name: "Khalid Al-Mutairi", email: "k.almutairi@dolftech.example", role: "super_admin", tenantId: null, tenantName: null },
    password: "Demo@123",
  },
  {
    user: { id: "usr-0142", name: "Noura Al-Qahtani", email: "n.alqahtani@alnoor-fs.example", role: "client_admin", tenantId: "TEN-00012", tenantName: "Al Noor Financial Services" },
    password: "Demo@123",
  },
  {
    user: { id: "usr-0157", name: "Faisal Al-Harbi", email: "f.alharbi@alnoor-fs.example", role: "operator", tenantId: "TEN-00012", tenantName: "Al Noor Financial Services" },
    password: "Demo@123",
  },
  {
    user: { id: "usr-0163", name: "Reem Al-Dosari", email: "r.aldosari@alnoor-fs.example", role: "viewer", tenantId: "TEN-00012", tenantName: "Al Noor Financial Services" },
    password: "Demo@123",
  },
];

export interface AuthService {
  restore(): Promise<SessionUser | null>;
  signIn(email: string, password: string, remember: boolean): Promise<SessionUser>;
  signOut(): Promise<void>;
}

const SESSION_KEY = "dc.mockSession";
const sessionDelay = () => new Promise((resolve) => window.setTimeout(resolve, 350));

const mockAuthService: AuthService = {
  async restore() {
    const accountId = window.sessionStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(SESSION_KEY);
    return DEVELOPMENT_ACCOUNTS.find((account) => account.user.id === accountId)?.user ?? null;
  },
  async signIn(email, password, remember) {
    await sessionDelay();
    const account = DEVELOPMENT_ACCOUNTS.find((candidate) => candidate.user.email.toLowerCase() === email.trim().toLowerCase() && candidate.password === password);
    if (!account) throw new Error("invalid_credentials");
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem("dc.devRole");
    (remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, account.user.id);
    return account.user;
  },
  async signOut() {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem("dc.devRole");
  },
};

const unavailableAuthService: AuthService = {
  async restore() { return null; },
  async signIn() { throw new Error("mock_auth_development_only"); },
  async signOut() {},
};

export const authService: AuthService = import.meta.env.DEV ? mockAuthService : unavailableAuthService;

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  user: SessionUser | null;
  status: SessionStatus;
  isPlatform: boolean;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<SessionUser>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  useEffect(() => {
    let active = true;
    void authService.restore().then((restoredUser) => {
      if (!active) return;
      setUser(restoredUser);
      setStatus(restoredUser ? "authenticated" : "unauthenticated");
    }).catch(() => {
      if (!active) return;
      setUser(null);
      setStatus("unauthenticated");
    });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    const authenticatedUser = await authService.signIn(email, password, remember);
    setUser(authenticatedUser);
    setStatus("authenticated");
    return authenticatedUser;
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    user,
    status,
    isPlatform: user?.role === "super_admin",
    can: (permission) => !!user && roleHas(user.role, permission),
    signIn,
    signOut,
  }), [user, status, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}