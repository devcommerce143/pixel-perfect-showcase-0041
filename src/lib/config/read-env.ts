import type { PortalEnvInput } from "./runtime.ts";

/** Reads public Vite variables. Secrets must not be given VITE_ names. */
export function readClientEnv(): PortalEnvInput {
  return {
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    VITE_API_MODE: import.meta.env.VITE_API_MODE,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_OIDC_ISSUER: import.meta.env.VITE_OIDC_ISSUER,
    VITE_OIDC_CLIENT_ID: import.meta.env.VITE_OIDC_CLIENT_ID,
    VITE_OIDC_REDIRECT_URI: import.meta.env.VITE_OIDC_REDIRECT_URI,
    VITE_OIDC_POST_LOGOUT_REDIRECT_URI: import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
    VITE_OIDC_SILENT_REDIRECT_URI: import.meta.env.VITE_OIDC_SILENT_REDIRECT_URI,
  };
}
