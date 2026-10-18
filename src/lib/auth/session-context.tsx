import { createContext, useContext } from "react";
import type { Permission } from "./permissions.ts";
import type { SessionUser } from "./session-user.ts";

export type SessionStatus =
  "loading" | "authenticated" | "unauthenticated" | "forbidden" | "error" | "configuration";

export interface SessionContextValue {
  user: SessionUser | null;
  status: SessionStatus;
  mode: "mock" | "live";
  configurationIssues: string[];
  correlationId: string | null;
  errorMessage: string | null;
  isPlatform: boolean;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  beginOrganizationSignIn: (returnTo: string) => Promise<void>;
  completeOrganizationSignIn: () => Promise<void>;
  retryProfile: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
