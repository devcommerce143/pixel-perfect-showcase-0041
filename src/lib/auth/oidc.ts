import type { LiveOidcSettings } from "../config/runtime.ts";

const RETURN_TO_KEY = "dc.oidcReturnTo";

/**
 * Authorization Code + PKCE through oidc-client-ts.
 * No client secret is configured. Tokens stay in the library's sessionStorage
 * store so the browser can finish the redirect; they are not written to
 * localStorage or application logs. The authorization code appears in the
 * callback URL only for the duration of the OIDC redirect, then the app
 * replaces that URL.
 *
 * Silent renewal runs only when VITE_OIDC_SILENT_REDIRECT_URI is set, and
 * only after a 401. It is not started automatically.
 */

type UserManagerInstance = import("oidc-client-ts").UserManager;

let managerPromise: Promise<UserManagerInstance> | null = null;
let cachedAccessToken: string | null = null;

/** In-memory only. The OIDC library keeps its own sessionStorage copy. */
export function getCachedAccessToken() {
  return cachedAccessToken;
}

export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token;
}

export function rememberReturnTo(value: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(RETURN_TO_KEY, value);
}

export function consumeReturnTo(): string {
  if (typeof window === "undefined") return "/";
  const value = window.sessionStorage.getItem(RETURN_TO_KEY);
  window.sessionStorage.removeItem(RETURN_TO_KEY);
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function startOrganizationSignIn(): Promise<void> {
  const manager = await getUserManager();
  await manager.signinRedirect();
}

export async function completeOrganizationSignIn(): Promise<string | null> {
  const manager = await getUserManager();
  const user = await manager.signinRedirectCallback();
  return user.access_token || null;
}

export async function readAccessToken(): Promise<string | null> {
  const manager = await getUserManager();
  const user = await manager.getUser();
  if (!user || user.expired || !user.access_token) return null;
  return user.access_token;
}

export async function renewAccessToken(): Promise<string | null> {
  const settings = requireLiveOidc();
  if (!settings.silentRedirectUri) return null;
  const manager = await getUserManager();
  const user = await manager.signinSilent();
  if (!user || user.expired || !user.access_token) return null;
  return user.access_token;
}

export async function endOrganizationSession(): Promise<void> {
  const manager = await getUserManager();
  await manager.signoutRedirect();
}

export async function clearOrganizationSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const manager = await getUserManager();
  await manager.removeUser();
}

async function getUserManager(): Promise<UserManagerInstance> {
  const settings = requireLiveOidc();
  if (typeof window === "undefined")
    throw new Error("Organization sign-in is only available in the browser.");
  if (!managerPromise) {
    managerPromise = import("oidc-client-ts").then(({ Log, UserManager, WebStorageStateStore }) => {
      Log.setLevel(Log.NONE);
      const store = new WebStorageStateStore({ store: window.sessionStorage });
      return new UserManager({
        authority: settings.issuer,
        client_id: settings.clientId,
        redirect_uri: settings.redirectUri,
        post_logout_redirect_uri: settings.postLogoutRedirectUri,
        response_type: "code",
        scope: "openid",
        automaticSilentRenew: false,
        disablePKCE: false,
        userStore: store,
        stateStore: store,
        ...(settings.silentRedirectUri ? { silent_redirect_uri: settings.silentRedirectUri } : {}),
      });
    });
  }
  return managerPromise;
}

function requireLiveOidc(): LiveOidcSettings {
  const config = currentOidcSettings;
  if (!config) throw new Error("Live identity configuration is not loaded.");
  return config;
}

let currentOidcSettings: LiveOidcSettings | null = null;

export function configureOidc(settings: LiveOidcSettings) {
  if (
    currentOidcSettings &&
    currentOidcSettings !== settings &&
    JSON.stringify(currentOidcSettings) !== JSON.stringify(settings)
  ) {
    managerPromise = null;
  }
  currentOidcSettings = settings;
}
