/** Public browser configuration only. Error messages never echo supplied values. */
export function productionConfigIssues(env: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const required = [
    "VITE_API_BASE_URL",
    "VITE_OIDC_ISSUER",
    "VITE_OIDC_REDIRECT_URI",
    "VITE_OIDC_POST_LOGOUT_REDIRECT_URI",
  ];
  const urls = new Map<string, URL>();
  for (const name of [...required, "VITE_OIDC_SILENT_REDIRECT_URI"]) {
    const value = env[name];
    if (!value && !required.includes(name)) continue;
    try {
      if (typeof value !== "string" || /\s/.test(value)) throw Error();
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !host.includes(".") ||
        host.endsWith(".") ||
        host.includes(":") ||
        /^[\d.]+$/.test(host) ||
        /(^|\.)(localhost|local|internal|invalid)$/.test(host)
      )
        throw Error();
      urls.set(name, url);
    } catch {
      issues.push(
        `${name} must be an approved HTTPS hostname URL without credentials, query, fragment, or local/IP address`,
      );
    }
  }
  if (env["VITE_API_MODE"] !== "live") issues.push("VITE_API_MODE must be live");
  if (
    typeof env["VITE_OIDC_CLIENT_ID"] !== "string" ||
    !/^[A-Za-z0-9._~-]{1,128}$/.test(env["VITE_OIDC_CLIENT_ID"])
  ) {
    issues.push("VITE_OIDC_CLIENT_ID must be a public OIDC client identifier");
  }
  const callback = urls.get("VITE_OIDC_REDIRECT_URI");
  const issuer = urls.get("VITE_OIDC_ISSUER");
  if (issuer && !/^\/realms\/[A-Za-z0-9_-]{1,64}\/?$/.test(issuer.pathname)) {
    issues.push("VITE_OIDC_ISSUER must identify the approved Keycloak /realms/<realm> issuer");
  }
  if (callback && callback.pathname !== "/auth/callback")
    issues.push("VITE_OIDC_REDIRECT_URI must use /auth/callback");
  for (const name of ["VITE_OIDC_POST_LOGOUT_REDIRECT_URI", "VITE_OIDC_SILENT_REDIRECT_URI"]) {
    const url = urls.get(name);
    if (callback && url && url.origin !== callback.origin)
      issues.push(`${name} must use the login callback origin`);
  }
  const allowed = new Set([
    ...required,
    "VITE_API_MODE",
    "VITE_OIDC_CLIENT_ID",
    "VITE_OIDC_SILENT_REDIRECT_URI",
  ]);
  for (const name of Object.keys(env)) {
    if (name.startsWith("VITE_") && !allowed.has(name)) {
      issues.push("Only the documented public VITE_ configuration keys are allowed in production");
    }
  }
  return issues;
}
