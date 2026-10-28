import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productionConfigIssues } from "./production.ts";
import { resolvePortalConfig } from "./runtime.ts";

const valid = {
  VITE_API_MODE: "live",
  VITE_API_BASE_URL: "https://api.example.com/api/v1",
  VITE_OIDC_ISSUER: "https://identity.example.com/realms/example",
  VITE_OIDC_CLIENT_ID: "public-browser-client",
  VITE_OIDC_REDIRECT_URI: "https://portal.example.com/auth/callback",
  VITE_OIDC_POST_LOGOUT_REDIRECT_URI: "https://portal.example.com/login",
};
describe("production browser configuration", () => {
  it("accepts public HTTPS browser configuration and preserves local development", () => {
    assert.deepEqual(productionConfigIssues(valid), []);
    assert.equal(resolvePortalConfig({ ...valid, DEV: false, PROD: true }).ok, true);
    assert.equal(
      resolvePortalConfig({
        ...valid,
        DEV: true,
        PROD: false,
        VITE_API_BASE_URL: "http://localhost:3000",
      }).ok,
      true,
    );
  });
  it("rejects missing values and mock mode", () => {
    assert.ok(productionConfigIssues({}).length >= 6);
    assert.ok(productionConfigIssues({ ...valid, VITE_API_MODE: "mock" }).length);
    assert.ok(
      productionConfigIssues({ ...valid, VITE_OIDC_ISSUER: "https://identity.example.com" }).length,
    );
  });
  it("rejects unsafe URLs for every required field without echoing values", () => {
    for (const name of [
      "VITE_API_BASE_URL",
      "VITE_OIDC_ISSUER",
      "VITE_OIDC_REDIRECT_URI",
      "VITE_OIDC_POST_LOGOUT_REDIRECT_URI",
    ]) {
      for (const url of [
        "http://api.example.com",
        "https://localhost",
        "https://127.0.0.1",
        "https://[::1]",
        "https://backend.internal",
        "https://user:sensitive-value@api.example.com",
        "https://api.example.com?token=sensitive-value",
        "https://api.example.com/#fragment",
      ]) {
        const issues = productionConfigIssues({ ...valid, [name]: url });
        assert.ok(issues.some((issue) => issue.includes(name)));
        assert.ok(!issues.join().includes("sensitive-value"));
      }
    }
  });
  it("keeps callbacks on the existing route and logout on the portal origin", () => {
    assert.ok(
      productionConfigIssues({
        ...valid,
        VITE_OIDC_REDIRECT_URI: "https://portal.example.com/wrong",
      }).length,
    );
    assert.ok(
      productionConfigIssues({
        ...valid,
        VITE_OIDC_POST_LOGOUT_REDIRECT_URI: "https://other.example.com/login",
      }).length,
    );
    assert.deepEqual(
      productionConfigIssues({
        ...valid,
        VITE_OIDC_SILENT_REDIRECT_URI: valid.VITE_OIDC_REDIRECT_URI,
      }),
      [],
    );
    assert.ok(
      productionConfigIssues({
        ...valid,
        VITE_OIDC_SILENT_REDIRECT_URI: "http://localhost/auth/callback",
      }).length,
    );
  });
  it("rejects secret-bearing public configuration", () => {
    const issues = productionConfigIssues({ ...valid, VITE_OIDC_CLIENT_SECRET: "sensitive-value" });
    assert.ok(issues.length);
    assert.ok(!issues.join().includes("sensitive-value"));
  });
});
