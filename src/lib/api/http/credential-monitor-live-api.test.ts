import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  credentialMonitorPath,
  credentialMonitorKey,
  mapCredentialMonitorPage,
} from "../credential-monitor.ts";
const id = "11111111-1111-4111-8111-111111111111",
  tenant = "22222222-2222-4222-8222-222222222222",
  application = "33333333-3333-4333-8333-333333333333";
const actor = { userId: id, role: "super_admin", tenantId: null, name: "Platform" } as const;
const query = { page: 1, pageSize: 20 };
const row = {
  id,
  tenantId: tenant,
  tenantName: "Tenant",
  applicationId: application,
  applicationName: "App",
  clientId: "actual-public-id",
  status: "ACTIVE",
  effectiveStatus: "EXPIRED",
  createdAt: "2026-10-21T00:00:00.000Z",
  expiresAt: "2026-10-21T00:00:00.000Z",
  lastUsedAt: null,
  rateLimitPerSecondOverride: null,
};
const page = { items: [row], page: 1, pageSize: 20, total: 1 };
describe("platform credential monitoring live contract", () => {
  it("builds exact validated platform filters without adding unsupported mutations or sorting", () => {
    assert.equal(
      credentialMonitorPath(actor, {
        ...query,
        tenantId: tenant,
        applicationId: application,
        status: "EXPIRED",
        search: " public ",
      }),
      `/platform/api-credentials?page=1&pageSize=20&tenantId=${tenant}&applicationId=${application}&status=EXPIRED&search=public`,
    );
    assert.throws(() => credentialMonitorPath({ ...actor, role: "viewer" }, query));
    assert.throws(() => credentialMonitorPath({ ...actor, userId: "" }, query));
    for (const changed of [
      { page: 0 },
      { pageSize: 101 },
      { page: 1.5 },
      { page: 1e9, pageSize: 100 },
      { tenantId: "bad" },
      { applicationId: "bad" },
      { search: "x".repeat(101) },
      { search: "bad\nvalue" },
    ])
      assert.throws(() => credentialMonitorPath(actor, { ...query, ...changed }));
  });
  it("projects safe metadata and keeps stored status separate from effective expiry", () => {
    const result = mapCredentialMonitorPage(
      {
        ...page,
        items: [
          {
            ...row,
            secret: "no",
            secretHash: "no",
            secretPrefix: "no",
            revokeReason: "private",
            createdByUserId: id,
          },
        ],
      },
      query,
    );
    assert.deepEqual(result, page);
    assert.equal(result.items[0]?.status, "ACTIVE");
    assert.equal(result.items[0]?.effectiveStatus, "EXPIRED");
    assert.equal(result.items[0]?.rateLimitPerSecondOverride, null);
    assert.equal(result.items[0]?.lastUsedAt, null);
    assert.deepEqual(mapCredentialMonitorPage({ ...page, items: [], total: 0 }, query).items, []);
  });
  it("rejects tenant/application/status mismatches and unknown stored statuses", () => {
    assert.throws(() => mapCredentialMonitorPage(page, { ...query, tenantId: application }));
    assert.throws(() => mapCredentialMonitorPage(page, { ...query, applicationId: tenant }));
    assert.throws(() => mapCredentialMonitorPage(page, { ...query, status: "ACTIVE" }));
    for (const changed of [
      { status: "UNKNOWN" },
      { effectiveStatus: "UNKNOWN" },
      { status: "REVOKED", effectiveStatus: "ACTIVE" },
      { createdAt: "bad" },
      { rateLimitPerSecondOverride: 0 },
    ])
      assert.throws(() =>
        mapCredentialMonitorPage({ ...page, items: [{ ...row, ...changed }] }, query),
      );
  });
  it("rejects pagination drift, duplicate rows and malformed totals", () => {
    for (const changed of [
      { page: 2 },
      { pageSize: 10 },
      { total: -1 },
      { total: 0 },
      { items: [row, row], total: 2 },
    ])
      assert.throws(() => mapCredentialMonitorPage({ ...page, ...changed }, query));
  });
  it("uses a human Bearer GET and validates the response", async () => {
    const paths: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "human",
      fetchImpl: async (url, init) => {
        paths.push(String(url));
        assert.equal(init?.method, "GET");
        assert.equal((init?.headers as Record<string, string>)["Authorization"], "Bearer human");
        return new Response(JSON.stringify(page));
      },
    });
    assert.deepEqual(await api.listCredentialMonitor(actor, query), page);
    assert.deepEqual(paths, [
      "https://api.example.test/api/v1/platform/api-credentials?page=1&pageSize=20",
    ]);
  });
  it("surfaces API errors without falling back to mock clients", async () => {
    for (const status of [401, 403, 404, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.test/api/v1",
        getAccessToken: () => "human",
        fetchImpl: async () => new Response('{"message":"denied"}', { status }),
      });
      await assert.rejects(api.listCredentialMonitor(actor, query), ApiError);
    }
  });
  it("isolates identity, role, tenant, filters and pagination in cache keys", () => {
    const base = credentialMonitorKey(actor, query);
    assert.notDeepEqual(base, credentialMonitorKey({ ...actor, userId: tenant }, query));
    assert.notDeepEqual(
      base,
      credentialMonitorKey({ ...actor, role: "viewer", tenantId: tenant }, query),
    );
    for (const changed of [
      { page: 2 },
      { pageSize: 50 },
      { tenantId: tenant },
      { applicationId: application },
      { status: "ACTIVE" as const },
      { search: "filter" },
    ])
      assert.notDeepEqual(base, credentialMonitorKey(actor, { ...query, ...changed }));
  });
  it("keeps mock rate editing isolated and links actual named-tenant application management", () => {
    const route = readFileSync(
      new URL("../../../routes/platform.api-clients.tsx", import.meta.url),
      "utf8",
    );
    assert.match(route, /apiMode === "mock"/);
    assert.match(route, /actor\.userId/);
    assert.match(route, /tenantId/);
    const ui = readFileSync(
      new URL("../../../components/app/CredentialMonitor.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(ui, /useMutation|api\.|updatePlatformClient|setPlatformClientStatus/);
    assert.match(ui, /tenantId: row\.tenantId, applicationId: row\.applicationId/);
    assert.match(ui, /list\.isError/);
    assert.match(ui, /ListPagination/);
  });
});
