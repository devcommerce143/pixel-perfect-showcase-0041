import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  credentialBasePath,
  credentialQueryString,
  credentialIssueBody,
  mapCredentialMetadata,
  mapCredentialRegistryPage,
  mapIssuedRegistryCredential,
} from "./credential-registry-mapper.ts";
import {
  credentialScopeKey,
  credentialListKey,
  credentialFailureKey,
} from "../credential-registry.ts";
import { roleHas } from "../../auth/permissions.ts";

const tenantId = "11111111-1111-4111-8111-111111111111",
  applicationId = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333",
  successor = "44444444-4444-4444-8444-444444444444";
const actor = { role: "client_admin", tenantId, userId: id, name: "Admin" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
const query = { page: 1, pageSize: 20 };
const row = {
  id,
  tenantId,
  applicationId,
  clientId: "client-123",
  secretPrefix: "prefix-123",
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  scopes: ["MESSAGES_SEND"],
  expiresAt: null,
  lastUsedAt: null,
  rateLimitPerSecondOverride: null,
  createdByUserId: id,
  revokedAt: null,
  revokedByUserId: null,
  revokeReason: null,
  rotatedFromCredentialId: null,
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
};
const issue = { scopes: ["MESSAGES_SEND" as const] };
describe("credential registry contract and scope boundaries", () => {
  it("requires explicit platform tenant and rejects tenant hopping or invalid object ids", () => {
    assert.equal(
      credentialBasePath(actor, applicationId),
      `/applications/${applicationId}/credentials`,
    );
    assert.equal(
      credentialBasePath(platform, applicationId, tenantId),
      `/tenants/${tenantId}/applications/${applicationId}/credentials`,
    );
    assert.throws(() => credentialBasePath(platform, applicationId));
    assert.throws(() => credentialBasePath(actor, applicationId, successor));
    assert.throws(() => credentialBasePath(actor, "invalid"));
  });
  it("validates pagination and exact issue inputs without fabricating environment or limits", () => {
    assert.equal(credentialQueryString(query), "page=1&pageSize=20");
    for (const invalid of [
      { page: 0, pageSize: 20 },
      { page: 1, pageSize: 101 },
      { page: 1e12, pageSize: 20 },
    ])
      assert.throws(() => credentialQueryString(invalid));
    assert.deepEqual(credentialIssueBody(issue), issue);
    assert.throws(() => credentialIssueBody({ scopes: [] }));
    assert.throws(() => credentialIssueBody({ scopes: ["MESSAGES_SEND", "MESSAGES_SEND"] }));
    assert.throws(() => credentialIssueBody({ ...issue, rateLimitPerSecondOverride: 0 }));
    assert.throws(() => credentialIssueBody({ ...issue, expiresAt: "2000-01-01T00:00:00.000Z" }));
  });
  it("maps effective expiry separately from stored state and strips all unlisted secret material", () => {
    const mapped = mapCredentialMetadata(
      {
        ...row,
        effectiveStatus: "EXPIRED",
        secret: "private",
        secretHash: "private",
        name: "invented",
      },
      actor,
      applicationId,
    );
    assert.equal(mapped.status, "ACTIVE");
    assert.equal(mapped.effectiveStatus, "EXPIRED");
    assert.equal("secret" in mapped, false);
    assert.equal("secretHash" in mapped, false);
    assert.equal("name" in mapped, false);
    for (const patch of [
      { tenantId: successor },
      { applicationId: successor },
      { scopes: ["PRIVATE"] },
      { effectiveStatus: "PRIVATE" },
      { createdByUserId: "Creator Name" },
    ])
      assert.throws(() => mapCredentialMetadata({ ...row, ...patch }, actor, applicationId));
  });
  it("validates page scope/counts and keeps the actual returned prefix and actor id", () => {
    const mapped = mapCredentialRegistryPage(
      { items: [row], total: 1, ...query },
      actor,
      applicationId,
      query,
    );
    assert.equal(mapped.items[0]?.secretPrefix, row.secretPrefix);
    assert.equal(mapped.items[0]?.createdByUserId, id);
    assert.throws(() =>
      mapCredentialRegistryPage({ items: [row], total: 0, ...query }, actor, applicationId, query),
    );
    assert.throws(() =>
      mapCredentialRegistryPage(
        { items: [row], total: 1, page: 2, pageSize: 20 },
        actor,
        applicationId,
        query,
      ),
    );
    assert.deepEqual(
      mapCredentialRegistryPage(
        { items: [], total: 1, page: 2, pageSize: 20 },
        actor,
        applicationId,
        { ...query, page: 2 },
      ).items,
      [],
    );
  });
  it("admits a one-time secret only for a valid new credential or matching rotation successor", () => {
    const issued = mapIssuedRegistryCredential(
      { ...row, secret: "once-only" },
      actor,
      applicationId,
    );
    assert.equal(issued.secret, "once-only");
    assert.equal("secret" in issued.credential, false);
    assert.throws(() => mapIssuedRegistryCredential(row, actor, applicationId));
    assert.throws(() =>
      mapIssuedRegistryCredential(
        { ...row, secret: "once-only" },
        actor,
        applicationId,
        undefined,
        id,
      ),
    );
    assert.equal(
      mapIssuedRegistryCredential(
        { ...row, id: successor, rotatedFromCredentialId: id, secret: "once-only" },
        actor,
        applicationId,
        undefined,
        id,
      ).credential.id,
      successor,
    );
  });
  it("isolates identity, platform/tenant, application and pagination cache keys", () => {
    const key = credentialListKey(actor, applicationId, query);
    assert.notDeepEqual(
      key,
      credentialListKey({ ...actor, userId: successor }, applicationId, query),
    );
    assert.notDeepEqual(key, credentialListKey(actor, successor, query));
    assert.notDeepEqual(key, credentialListKey(actor, applicationId, { ...query, page: 2 }));
    assert.notDeepEqual(key, credentialListKey(platform, applicationId, query, tenantId));
    assert.notDeepEqual(
      credentialScopeKey(platform, applicationId, tenantId),
      credentialScopeKey(platform, applicationId, successor),
    );
  });
  it("separates platform credential management permission from VIEWER and operator access", () => {
    assert.equal(roleHas("super_admin", "platform.credentials.manage"), true);
    assert.equal(roleHas("client_admin", "credentials.manage"), true);
    for (const role of ["viewer", "operator"] as const) {
      assert.equal(roleHas(role, "credentials.manage"), false);
      assert.equal(roleHas(role, "platform.credentials.manage"), false);
    }
  });
  it("isolates live/mock route branches and keeps secrets out of cache returns and persistent storage", () => {
    const route = readFileSync(new URL("../../../routes/credentials.tsx", import.meta.url), "utf8");
    const ui = readFileSync(
      new URL("../../../components/app/CredentialRegistry.tsx", import.meta.url),
      "utf8",
    );
    assert.match(route, /apiMode === "mock"/);
    assert.match(route, /key=/);
    assert.match(ui, /return issued\.credential/);
    assert.match(ui, /retry: false/);
    assert.doesNotMatch(ui, /localStorage|sessionStorage|api\./);
  });
});
describe("credential registry human HTTP", () => {
  it("uses exact human read, issue, rotate and revoke routes and bodies", async () => {
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    const api = createLiveApi({
      apiBaseUrl: "http://localhost:3000",
      getAccessToken: () => "human-token",
      fetchImpl: async (input, init) => {
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer human-token");
        const url = String(input),
          method = init?.method ?? "GET";
        requests.push({
          url,
          method,
          body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
        });
        const result =
          method === "GET"
            ? url.includes("?")
              ? { items: [row], total: 1, ...query }
              : row
            : url.endsWith("/rotate")
              ? { ...row, id: successor, rotatedFromCredentialId: id, secret: "once-only" }
              : url.endsWith("/revoke")
                ? { ...row, status: "REVOKED", effectiveStatus: "REVOKED" }
                : { ...row, secret: "once-only" };
        return new Response(JSON.stringify(result), { status: 200 });
      },
    });
    await api.listCredentialRegistry(actor, applicationId, query);
    await api.getCredentialRegistry(platform, applicationId, id, tenantId);
    const issued = await api.issueRegistryCredential(actor, applicationId, issue);
    assert.equal(issued.secret, "once-only");
    await api.rotateRegistryCredential(platform, applicationId, id, issue, tenantId);
    await api.revokeRegistryCredential(actor, applicationId, id, "Rotation incident");
    assert.match(
      requests[0]!.url,
      new RegExp(`/applications/${applicationId}/credentials\\?page=1&pageSize=20$`),
    );
    assert.match(
      requests[1]!.url,
      new RegExp(`/tenants/${tenantId}/applications/${applicationId}/credentials/${id}$`),
    );
    assert.deepEqual(requests[2]!.body, issue);
    assert.equal(requests[2]!.method, "POST");
    assert.match(requests[3]!.url, /\/rotate$/);
    assert.deepEqual(requests[3]!.body, issue);
    assert.deepEqual(requests[4]!.body, { reason: "Rotation incident" });
  });
  it("surfaces failures without mock fallback or automatic mutation retry", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: "http://localhost:3000",
      getAccessToken: () => "human-token",
      fetchImpl: async () => {
        calls++;
        return new Response(JSON.stringify({ message: "Unavailable" }), { status: 503 });
      },
    });
    await assert.rejects(api.issueRegistryCredential(actor, applicationId, issue), ApiError);
    assert.equal(calls, 1);
    assert.equal(
      credentialFailureKey(new ApiError({ statusCode: 409, message: "Conflict" })),
      "liveCredentials.error.conflict",
    );
    await assert.rejects(api.listCredentialRegistry(actor, applicationId, query), ApiError);
  });
  it("rejects malformed or wrong-scope live data", async () => {
    const api = createLiveApi({
      apiBaseUrl: "http://localhost:3000",
      getAccessToken: () => "human-token",
      fetchImpl: async () =>
        new Response(JSON.stringify({ ...row, tenantId: successor }), { status: 200 }),
    });
    await assert.rejects(api.getCredentialRegistry(actor, applicationId, id));
  });
});
