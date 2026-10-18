import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { roleHas } from "./permissions.ts";
import {
  SessionContext,
  type SessionContextValue,
  type SessionStatus,
} from "./session-context.tsx";
import type { SessionUser } from "./session-user.ts";

interface DevelopmentAccount {
  user: SessionUser;
  password: string;
}

const DEVELOPMENT_ACCOUNTS: DevelopmentAccount[] = [
  {
    user: {
      id: "usr-0001",
      name: "Khalid Al-Mutairi",
      email: "k.almutairi@dolftech.example",
      role: "super_admin",
      tenantId: null,
      tenantName: null,
    },
    password: "Demo@123",
  },
  {
    user: {
      id: "usr-0142",
      name: "Noura Al-Qahtani",
      email: "n.alqahtani@alnoor-fs.example",
      role: "client_admin",
      tenantId: "TEN-00012",
      tenantName: "Al Noor Financial Services",
    },
    password: "Demo@123",
  },
  {
    user: {
      id: "usr-0157",
      name: "Faisal Al-Harbi",
      email: "f.alharbi@alnoor-fs.example",
      role: "operator",
      tenantId: "TEN-00012",
      tenantName: "Al Noor Financial Services",
    },
    password: "Demo@123",
  },
  {
    user: {
      id: "usr-0163",
      name: "Reem Al-Dosari",
      email: "r.aldosari@alnoor-fs.example",
      role: "viewer",
      tenantId: "TEN-00012",
      tenantName: "Al Noor Financial Services",
    },
    password: "Demo@123",
  },
];

const SESSION_KEY = "dc.mockSession";
const sessionDelay = () => new Promise((resolve) => window.setTimeout(resolve, 350));

async function restoreMockUser() {
  const accountId =
    window.sessionStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(SESSION_KEY);
  return DEVELOPMENT_ACCOUNTS.find((account) => account.user.id === accountId)?.user ?? null;
}

async function signInMock(email: string, password: string, remember: boolean) {
  await sessionDelay();
  const account = DEVELOPMENT_ACCOUNTS.find(
    (candidate) =>
      candidate.user.email.toLowerCase() === email.trim().toLowerCase() &&
      candidate.password === password,
  );
  if (!account) throw new Error("invalid_credentials");
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem("dc.devRole");
  (remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, account.user.id);
  return account.user;
}

async function signOutMock() {
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem("dc.devRole");
}

/** Development-only password session. Loaded only when API mode is mock. */
export function MockSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  useEffect(() => {
    let active = true;
    void restoreMockUser()
      .then((restoredUser) => {
        if (!active) return;
        setUser(restoredUser);
        setStatus(restoredUser ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("unauthenticated");
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    const authenticatedUser = await signInMock(email, password, remember);
    setUser(authenticatedUser);
    setStatus("authenticated");
    return authenticatedUser;
  }, []);

  const signOut = useCallback(async () => {
    await signOutMock();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      status,
      mode: "mock",
      configurationIssues: [],
      correlationId: null,
      errorMessage: null,
      isPlatform: user?.role === "super_admin",
      can: (permission) => status === "authenticated" && !!user && roleHas(user.role, permission),
      signIn,
      signOut,
      beginOrganizationSignIn: async () => {
        throw new Error("organization_sign_in_unavailable");
      },
      completeOrganizationSignIn: async () => {
        throw new Error("organization_sign_in_unavailable");
      },
      retryProfile: async () => {},
    }),
    [signIn, signOut, status, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
