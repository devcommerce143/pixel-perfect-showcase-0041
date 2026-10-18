import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildApiUrl,
  resolvePortalConfig,
  selectPortalApi,
  type PortalEnvInput,
} from "./runtime.ts";

const dev: PortalEnvInput = { DEV: true, PROD: false };
const liveBase = {
  DEV: false,
  PROD: false,
  VITE_API_MODE: "live",
  VITE_API_BASE_URL: "https://engine.example",
  VITE_OIDC_ISSUER: "https://id.example/realms/dolf",
  VITE_OIDC_CLIENT_ID: "dolf-connect",
  VITE_OIDC_REDIRECT_URI: "https://portal.example/auth/callback",
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI: "https://portal.example/login",
} satisfies PortalEnvInput;

describe("portal mode", () => {
  it("defaults local development to mock", () => {
    const config = resolvePortalConfig(dev);
    assert.deepEqual(config, { ok: true, mode: "mock" });
  });

  it("keeps an explicit mock selection in development", () => {
    assert.equal(resolvePortalConfig({ ...dev, VITE_API_MODE: "mock" }).ok, true);
  });

  it("rejects mock mode in a production build", () => {
    const config = resolvePortalConfig({ DEV: false, PROD: true, VITE_API_MODE: "mock" });
    assert.equal(config.ok, false);
    assert.equal(config.mode, "live");
  });

  it("does not turn an unknown mode into mock", () => {
    const config = resolvePortalConfig({ ...dev, VITE_API_MODE: "staging" });
    assert.equal(config.ok, false);
    assert.equal(config.mode, "live");
  });

  it("fails clearly when live settings are missing", () => {
    const config = resolvePortalConfig({ ...dev, VITE_API_MODE: "live" });
    assert.equal(config.ok, false);
    if (config.ok) return;
    assert.ok(config.issues.some((issue) => issue.includes("VITE_API_BASE_URL")));
    assert.ok(config.issues.some((issue) => issue.includes("VITE_OIDC_ISSUER")));
    assert.ok(config.issues.some((issue) => issue.includes("VITE_OIDC_CLIENT_ID")));
    assert.ok(config.issues.some((issue) => issue.includes("VITE_OIDC_REDIRECT_URI")));
    assert.ok(config.issues.some((issue) => issue.includes("VITE_OIDC_POST_LOGOUT_REDIRECT_URI")));
  });

  it("does not fall back to the mock factory when live mode is selected", () => {
    const missing = resolvePortalConfig({ ...dev, VITE_API_MODE: "live" });
    const ready = resolvePortalConfig(liveBase);
    let mockCalls = 0;
    assert.equal(
      selectPortalApi(
        missing,
        () => {
          mockCalls += 1;
          return "mock";
        },
        () => "live",
      ),
      "live",
    );
    assert.equal(
      selectPortalApi(
        ready,
        () => {
          mockCalls += 1;
          return "mock";
        },
        () => "live",
      ),
      "live",
    );
    assert.equal(
      selectPortalApi(
        resolvePortalConfig(dev),
        () => "mock",
        () => {
          throw new Error("live factory should not run");
        },
      ),
      "mock",
    );
    assert.equal(mockCalls, 0);
  });

  it("builds one /api/v1 base and rejects absolute request paths", () => {
    const origin = resolvePortalConfig(liveBase);
    const already = resolvePortalConfig({
      ...liveBase,
      VITE_API_BASE_URL: "https://engine.example/api/v1/",
    });
    if (!origin.ok || origin.mode !== "live" || !already.ok || already.mode !== "live") {
      throw new Error("expected a valid live configuration");
    }
    assert.equal(origin.apiBaseUrl, "https://engine.example/api/v1");
    assert.equal(already.apiBaseUrl, "https://engine.example/api/v1");
    assert.equal(
      buildApiUrl(origin.apiBaseUrl, "/auth/me"),
      "https://engine.example/api/v1/auth/me",
    );
    assert.throws(() => buildApiUrl(origin.apiBaseUrl, "https://elsewhere.example/auth/me"));
  });

  it("rejects an API base URL that embeds credentials", () => {
    const config = resolvePortalConfig({
      ...liveBase,
      VITE_API_BASE_URL: "https://user:secret@engine.example",
    });
    assert.equal(config.ok, false);
  });
});
