import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createHumanHttpClient, type HumanHttpClient } from "../api/http/client.ts";
import type { PortalConfig } from "../config/runtime.ts";
import { roleHas } from "./permissions.ts";
import { loadAuthoritativeProfile, type ProfileAccess } from "./profile.ts";
import {
  clearOrganizationSession,
  completeOrganizationSignIn as completeOidcSignIn,
  configureOidc,
  endOrganizationSession,
  getCachedAccessToken,
  readAccessToken,
  rememberReturnTo,
  renewAccessToken,
  setCachedAccessToken,
  startOrganizationSignIn,
} from "./oidc.ts";
import {
  SessionContext,
  type SessionContextValue,
  type SessionStatus,
} from "./session-context.tsx";
import type { SessionUser } from "./session-user.ts";

let callbackTask: Promise<void> | null = null;

export function LiveSessionProvider({
  config,
  children,
}: {
  config: Exclude<PortalConfig, { mode: "mock" }>;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>(config.ok ? "loading" : "configuration");
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const http = useMemo<HumanHttpClient | null>(() => {
    if (!config.ok) return null;
    return createHumanHttpClient({
      apiBaseUrl: config.apiBaseUrl,
      getAccessToken: getCachedAccessToken,
    });
  }, [config]);

  const applyAccess = useCallback((access: ProfileAccess) => {
    setCorrelationId("correlationId" in access ? access.correlationId : null);
    if (access.type === "authenticated") {
      setUser(access.user);
      setErrorMessage(null);
      setStatus("authenticated");
      return;
    }
    setUser(null);
    if (access.type === "forbidden") {
      setErrorMessage(null);
      setStatus("forbidden");
      return;
    }
    if (access.type === "error") {
      setErrorMessage(access.message);
      setStatus("error");
      return;
    }
    setErrorMessage(null);
    setStatus("unauthenticated");
  }, []);

  const loadProfile = useCallback(async (client: HumanHttpClient, allowRenew: boolean) => {
    let access = await loadAuthoritativeProfile(client);
    if (access.type !== "unauthenticated" || !allowRenew) return access;
    const renewed = await renewAccessToken();
    setCachedAccessToken(renewed);
    if (!renewed) {
      await clearOrganizationSession();
      setCachedAccessToken(null);
      return access;
    }
    access = await loadAuthoritativeProfile(client);
    if (access.type === "unauthenticated") {
      await clearOrganizationSession();
      setCachedAccessToken(null);
    }
    return access;
  }, []);

  const restore = useCallback(async () => {
    if (!config.ok || !http) return;
    configureOidc(config.oidc);
    if (typeof window !== "undefined" && window.location.pathname === "/auth/callback") return;
    try {
      const token = await readAccessToken();
      setCachedAccessToken(token);
      if (!token) {
        setUser(null);
        setCorrelationId(null);
        setErrorMessage(null);
        setStatus("unauthenticated");
        return;
      }
      applyAccess(await loadProfile(http, true));
    } catch {
      setCachedAccessToken(null);
      setUser(null);
      setErrorMessage("The profile request failed.");
      setStatus("error");
    }
  }, [applyAccess, config, http, loadProfile]);

  useEffect(() => {
    if (!config.ok) return;
    void restore();
  }, [config.ok, restore]);

  const beginOrganizationSignIn = useCallback(
    async (returnTo: string) => {
      if (!config.ok) throw new Error("live_configuration_incomplete");
      configureOidc(config.oidc);
      callbackTask = null;
      const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
      rememberReturnTo(safe);
      await startOrganizationSignIn();
    },
    [config],
  );

  const completeOrganizationSignIn = useCallback(() => {
    if (!config.ok || !http) {
      setStatus("configuration");
      return Promise.resolve();
    }
    if (!callbackTask) {
      callbackTask = (async () => {
        if (!config.ok) return;
        configureOidc(config.oidc);
        try {
          const token = await completeOidcSignIn();
          setCachedAccessToken(token);
          if (!token) {
            setUser(null);
            setStatus("unauthenticated");
            return;
          }
          applyAccess(await loadProfile(http, true));
        } catch {
          setCachedAccessToken(null);
          setUser(null);
          setErrorMessage(null);
          setStatus("unauthenticated");
        }
      })();
    }
    return callbackTask;
  }, [applyAccess, config, http, loadProfile]);

  const retryProfile = useCallback(async () => {
    if (!config.ok || !http) return;
    configureOidc(config.oidc);
    setStatus("loading");
    try {
      const token = await readAccessToken();
      setCachedAccessToken(token);
      if (!token) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      applyAccess(await loadProfile(http, true));
    } catch {
      setErrorMessage("The profile request failed.");
      setStatus("error");
    }
  }, [applyAccess, config, http, loadProfile]);

  const signIn = useCallback(async () => {
    throw new Error("password_sign_in_unavailable");
  }, []);

  const signOut = useCallback(async () => {
    if (config.ok) configureOidc(config.oidc);
    try {
      await endOrganizationSession();
    } catch {
      await clearOrganizationSession().catch(() => undefined);
      setCachedAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
      throw new Error("sign_out_failed");
    }
  }, [config]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      status,
      mode: "live",
      configurationIssues: config.ok ? [] : config.issues,
      correlationId,
      errorMessage,
      isPlatform: user?.role === "super_admin",
      can: (permission) => status === "authenticated" && !!user && roleHas(user.role, permission),
      signIn,
      signOut,
      beginOrganizationSignIn,
      completeOrganizationSignIn,
      retryProfile,
    }),
    [
      beginOrganizationSignIn,
      completeOrganizationSignIn,
      config,
      correlationId,
      errorMessage,
      retryProfile,
      signIn,
      signOut,
      status,
      user,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
