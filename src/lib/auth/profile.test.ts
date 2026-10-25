import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HumanHttpClient } from "../api/http/client.ts";
import { ApiError } from "../api/http/errors.ts";
import { loadAuthoritativeProfile, mapBackendProfile } from "./profile.ts";

function client(result: () => Promise<unknown>): HumanHttpClient {
  return {
    getCsv: async () => {
      throw new Error("Unexpected CSV request in profile test");
    },
    get: <T>() => result() as Promise<T>,
    post: async <T>() => undefined as T,
    patch: async <T>() => undefined as T,
    put: async <T>() => undefined as T,
    delete: async <T>() => undefined as T,
  };
}

const viewer = { userId: "user-1", role: "VIEWER", tenantId: "TEN-1", status: "active" };

describe("backend profile", () => {
  it("treats 401 and 403 differently and does not grant access", async () => {
    const unauthorized = await loadAuthoritativeProfile(
      client(async () => {
        throw new ApiError({ statusCode: 401, message: "Unauthorized", correlationId: "corr-401" });
      }),
    );
    const forbidden = await loadAuthoritativeProfile(
      client(async () => {
        throw new ApiError({ statusCode: 403, message: "Forbidden", correlationId: "corr-403" });
      }),
    );
    assert.equal(unauthorized.type, "unauthenticated");
    assert.equal(forbidden.type, "forbidden");
    if (unauthorized.type === "unauthenticated")
      assert.equal(unauthorized.correlationId, "corr-401");
    if (forbidden.type === "forbidden") assert.equal(forbidden.correlationId, "corr-403");
  });

  it("does not grant access for an unknown role", async () => {
    const access = await loadAuthoritativeProfile(
      client(async () => ({ ...viewer, role: "TENANT_OWNER" })),
    );
    assert.equal(access.type, "forbidden");
    if (access.type === "forbidden") assert.equal(access.reason, "unknown_role");
  });

  it("does not grant access when a tenant role has no tenant", async () => {
    const missing = await loadAuthoritativeProfile(
      client(async () => ({ ...viewer, role: "OPERATOR", tenantId: null })),
    );
    const blank = await loadAuthoritativeProfile(
      client(async () => ({ ...viewer, role: "CLIENT_ADMIN", tenantId: "  " })),
    );
    assert.equal(missing.type, "forbidden");
    assert.equal(blank.type, "forbidden");
    if (missing.type === "forbidden") assert.equal(missing.reason, "missing_tenant");
  });

  it("does not keep a platform administrator inside a tenant", () => {
    const user = mapBackendProfile({
      userId: "admin-1",
      role: "PLATFORM_SUPER_ADMIN",
      tenantId: "TEN-9",
      status: "active",
    });
    assert.equal(user.role, "super_admin");
    assert.equal(user.tenantId, null);
  });

  it("rejects a disabled profile instead of granting portal access", async () => {
    const access = await loadAuthoritativeProfile(
      client(async () => ({ ...viewer, status: "Suspended" })),
    );
    assert.equal(access.type, "forbidden");
    if (access.type === "forbidden") assert.equal(access.reason, "disabled");
  });

  it("maps a valid tenant profile without inventing an email", () => {
    const user = mapBackendProfile(viewer);
    assert.equal(user.role, "viewer");
    assert.equal(user.tenantId, "TEN-1");
    assert.equal(user.email, "");
    assert.equal(user.name, "");
  });

  it("uses server-resolved display names without changing identity or role", () => {
    const user = mapBackendProfile({
      ...viewer,
      name: "Sara Ahmed",
      email: "sara@example.test",
      tenantName: "Dolftech",
    });
    assert.equal(user.name, "Sara Ahmed");
    assert.equal(user.email, "sara@example.test");
    assert.equal(user.tenantName, "Dolftech");
    assert.equal(user.id, viewer.userId);
    assert.equal(user.role, "viewer");
  });
  it("never uses UUID display-name fields as visible identity fallbacks", () => {
    const id = "593d3b12-613e-49c9-90ac-45941a827edf";
    const user = mapBackendProfile({ ...viewer, userId: id, name: id, tenantName: id });
    assert.equal(user.id, id);
    assert.equal(user.name, "");
    assert.equal(user.tenantName, null);
  });
});
