import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { readClientEnv } from "../config/read-env";
import { resolvePortalConfig } from "../config/runtime";
import { LiveSessionProvider } from "./live-session";
import {
  SessionContext,
  useSession,
  type SessionContextValue,
  type SessionStatus,
} from "./session-context";
import type { SessionUser } from "./session-user";

export type { SessionStatus, SessionUser };

const loadingValue: SessionContextValue = {
  user: null,
  status: "loading",
  mode: "mock",
  configurationIssues: [],
  correlationId: null,
  errorMessage: null,
  isPlatform: false,
  can: () => false,
  signIn: async () => {
    throw new Error("mock_session_loading");
  },
  signOut: async () => {},
  beginOrganizationSignIn: async () => {
    throw new Error("mock_session_loading");
  },
  completeOrganizationSignIn: async () => {},
  retryProfile: async () => {},
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => resolvePortalConfig(readClientEnv()), []);
  const [MockProvider, setMockProvider] = useState<ComponentType<{ children: ReactNode }> | null>(
    null,
  );
  const mockMode = config.ok && config.mode === "mock";

  useEffect(() => {
    if (!mockMode) return;
    let active = true;
    void import("./mock-session").then((mod) => {
      if (active) setMockProvider(() => mod.MockSessionProvider);
    });
    return () => {
      active = false;
    };
  }, [mockMode]);

  if (config.ok && config.mode === "mock") {
    if (!MockProvider)
      return <SessionContext.Provider value={loadingValue}>{children}</SessionContext.Provider>;
    return <MockProvider>{children}</MockProvider>;
  }

  return <LiveSessionProvider config={config}>{children}</LiveSessionProvider>;
}

export { useSession };
