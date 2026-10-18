/**
 * Pure portal mode and live-configuration checks.
 * No network calls and no default to mock after a live failure.
 */

export type ApiMode = "mock" | "live";

export interface PortalEnvInput {
  DEV: boolean;
  PROD: boolean;
  VITE_API_MODE?: string | undefined;
  VITE_API_BASE_URL?: string | undefined;
  VITE_OIDC_ISSUER?: string | undefined;
  VITE_OIDC_CLIENT_ID?: string | undefined;
  VITE_OIDC_REDIRECT_URI?: string | undefined;
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI?: string | undefined;
  VITE_OIDC_SILENT_REDIRECT_URI?: string | undefined;
}

export interface LiveOidcSettings {
  issuer: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  silentRedirectUri: string | null;
}

export type PortalConfig =
  | { ok: true; mode: "mock" }
  | { ok: true; mode: "live"; apiBaseUrl: string; oidc: LiveOidcSettings }
  | { ok: false; mode: "live"; issues: string[] };

const ABSOLUTE_HTTP = /^https?:\/\/[^\s]+$/i;

export function resolvePortalConfig(env: PortalEnvInput): PortalConfig {
  const requested = env.VITE_API_MODE?.trim().toLowerCase() ?? "";

  if (env.PROD) {
    if (requested === "mock" || requested === "") {
      return {
        ok: false,
        mode: "live",
        issues: [
          "VITE_API_MODE must be live in a production build. Mock mode is limited to local development.",
        ],
      };
    }
  }

  if (requested !== "" && requested !== "mock" && requested !== "live") {
    return { ok: false, mode: "live", issues: ["VITE_API_MODE must be mock or live."] };
  }

  const mode: ApiMode =
    requested === "live" || requested === "mock" ? requested : env.DEV ? "mock" : "live";

  if (mode === "mock") {
    if (env.PROD) {
      return {
        ok: false,
        mode: "live",
        issues: [
          "VITE_API_MODE must be live in a production build. Mock mode is limited to local development.",
        ],
      };
    }
    return { ok: true, mode: "mock" };
  }

  const issues: string[] = [];
  const apiBaseUrl = normalizeApiBaseUrl(env.VITE_API_BASE_URL, issues);
  const issuer = requireAbsoluteUrl("VITE_OIDC_ISSUER", env.VITE_OIDC_ISSUER, issues);
  const clientId = requireText("VITE_OIDC_CLIENT_ID", env.VITE_OIDC_CLIENT_ID, issues);
  const redirectUri = requireAbsoluteUrl(
    "VITE_OIDC_REDIRECT_URI",
    env.VITE_OIDC_REDIRECT_URI,
    issues,
  );
  const postLogoutRedirectUri = requireAbsoluteUrl(
    "VITE_OIDC_POST_LOGOUT_REDIRECT_URI",
    env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
    issues,
  );
  const silentRaw = env.VITE_OIDC_SILENT_REDIRECT_URI?.trim() ?? "";
  let silentRedirectUri: string | null = null;
  if (silentRaw) {
    if (!ABSOLUTE_HTTP.test(silentRaw))
      issues.push("VITE_OIDC_SILENT_REDIRECT_URI must be an absolute http(s) URL.");
    else silentRedirectUri = silentRaw.replace(/\/+$/, "");
  }

  if (
    !apiBaseUrl ||
    !issuer ||
    !clientId ||
    !redirectUri ||
    !postLogoutRedirectUri ||
    issues.length > 0
  ) {
    return { ok: false, mode: "live", issues };
  }

  return {
    ok: true,
    mode: "live",
    apiBaseUrl,
    oidc: { issuer, clientId, redirectUri, postLogoutRedirectUri, silentRedirectUri },
  };
}

export function selectPortalApi<T>(
  config: PortalConfig,
  createMock: () => T,
  createLive: () => T,
): T {
  if (config.ok && config.mode === "mock") return createMock();
  return createLive();
}

export function buildApiUrl(apiBaseUrl: string, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    throw new Error("API paths must be relative to /api/v1.");
  }
  return `${apiBaseUrl}${path}`;
}

function normalizeApiBaseUrl(value: string | undefined, issues: string[]): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    issues.push("VITE_API_BASE_URL is required in live mode.");
    return null;
  }
  if (!ABSOLUTE_HTTP.test(trimmed) || /:\/\/[^/\s]*@/.test(trimmed)) {
    issues.push("VITE_API_BASE_URL must be an absolute http(s) URL without embedded credentials.");
    return null;
  }
  const withoutSlash = trimmed.replace(/\/+$/, "");
  return withoutSlash.endsWith("/api/v1") ? withoutSlash : `${withoutSlash}/api/v1`;
}

function requireText(name: string, value: string | undefined, issues: string[]): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    issues.push(`${name} is required in live mode.`);
    return null;
  }
  return trimmed;
}

function requireAbsoluteUrl(
  name: string,
  value: string | undefined,
  issues: string[],
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    issues.push(`${name} is required in live mode.`);
    return null;
  }
  if (!ABSOLUTE_HTTP.test(trimmed)) {
    issues.push(`${name} must be an absolute http(s) URL.`);
    return null;
  }
  return trimmed.replace(/\/+$/, "");
}
