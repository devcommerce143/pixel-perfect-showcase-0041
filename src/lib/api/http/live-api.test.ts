import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./errors.ts";
import { LiveApiNotConnectedError } from "./errors.ts";
import { createLiveApi } from "./live-api.ts";
import { isLiveDashboardUnavailable } from "../dashboard-availability.ts";

const base = "https://engine.example/api/v1";
const token = "test-access-token";

const body = {
  scope: "tenant",
  tenantId: "11111111-1111-1111-1111-111111111111",
  range: { from: "2026-10-04T00:00:00.000Z", to: "2026-10-18T00:00:00.000Z" },
  messages: { total: 4, delivered: 1, pending: 1, failed: 0, unknown: 1, submitted: 1 },
  trend: [],
  channels: [
    { channel: "SMS", count: 2 },
    { channel: "EMAIL", count: 1 },
    { channel: "WHATSAPP", count: 1 },
  ],
  usage: {
    periodStart: "2026-10-01",
    channels: [],
    aggregate: { committedCount: 9, reservedCount: 0, monthlyQuota: 20 },
  },
};

describe("live dashboard client", () => {
  it("calls GET /dashboard with the existing bearer token and maps the body", async () => {
    const seen: Array<{ url: string; authorization: string | null; method: string }> = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        seen.push({
          url: String(input),
          authorization: headers.get("Authorization"),
          method: init?.method ?? "",
        });
        return new Response(JSON.stringify(body), { status: 200 });
      },
    });

    const summary = await api.getDashboard();
    assert.deepEqual(seen, [{
      url: `${base}/dashboard`,
      authorization: `Bearer ${token}`,
      method: "GET",
    }]);
    assert.equal(summary.kpis.total, 4);
    assert.equal(summary.kpis.submitted, 1);
    assert.equal(summary.kpis.unknown, 1);
    assert.equal(summary.kpis.deliveryRate, 25);
    assert.deepEqual(summary.quota, { used: 9, limit: 20 });
    assert.equal(isLiveDashboardUnavailable(null), false);
  });

  it("keeps authentication and unexpected responses out of the unavailable-data fallback", async () => {
    let calls = 0;
    const unauthenticated = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => null,
      fetchImpl: async () => {
        calls += 1;
        return new Response("{}", { status: 200 });
      },
    });
    await assert.rejects(
      () => unauthenticated.getDashboard(),
      (error: unknown) => error instanceof ApiError && error.statusCode === 401 && !isLiveDashboardUnavailable(error),
    );
    assert.equal(calls, 0);

    const forbidden = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => new Response(JSON.stringify({ message: "Forbidden", statusCode: 403 }), { status: 403 }),
    });
    await assert.rejects(
      () => forbidden.getDashboard(),
      (error: unknown) => error instanceof ApiError && error.statusCode === 403 && !isLiveDashboardUnavailable(error),
    );

    const invalid = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => new Response(JSON.stringify({ scope: "tenant" }), { status: 200 }),
    });
    await assert.rejects(
      () => invalid.getDashboard(),
      (error: unknown) => error instanceof Error && error.name === "DashboardResponseError" && !isLiveDashboardUnavailable(error),
    );
  });

  it("calls GET /dashboard/messages without a tenant selector", async () => {
    const seen: Array<{ url: string; method: string; headerNames: string[]; authorization: string | null }> = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        seen.push({
          url: String(input),
          method: init?.method ?? "",
          headerNames: [...headers.keys()],
          authorization: headers.get("Authorization"),
        });
        return new Response(JSON.stringify({
          scope: "platform",
          tenantId: null,
          items: [],
        }), { status: 200 });
      },
    });

    const messages = await api.getDashboardMessages();
    const request = seen[0];
    assert.ok(request);
    const url = new URL(request.url);
    assert.equal(url.pathname, "/api/v1/dashboard/messages");
    assert.equal(url.search, "");
    assert.equal(request.method, "GET");
    assert.equal(request.authorization, `Bearer ${token}`);
    assert.equal(request.headerNames.some((name) => name.toLowerCase().includes("tenant")), false);
    assert.deepEqual(messages, { scope: "platform", tenantId: null, items: [] });
  });

  it("calls GET /dashboard/quota without a tenant selector", async () => {
    const seen: Array<{ url: string; method: string; headerNames: string[]; authorization: string | null }> = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        seen.push({
          url: String(input),
          method: init?.method ?? "",
          headerNames: [...headers.keys()],
          authorization: headers.get("Authorization"),
        });
        return new Response(JSON.stringify({
          scope: "platform",
          tenantId: null,
          periodStart: "2026-10-01",
          counts: { atOrAbove80: 1, atOrAbove90: 1, atOrAbove100: 0, unconfigured: 3 },
        }), { status: 200 });
      },
    });

    const quota = await api.getDashboardQuota();
    const request = seen[0];
    assert.ok(request);
    const url = new URL(request.url);
    assert.equal(url.pathname, "/api/v1/dashboard/quota");
    assert.equal(url.search, "");
    assert.equal(request.method, "GET");
    assert.equal(request.authorization, `Bearer ${token}`);
    assert.equal(request.headerNames.some((name) => name.toLowerCase().includes("tenant")), false);
    assert.equal(quota.scope, "platform");
    if (quota.scope === "platform") assert.equal(quota.counts.unconfigured, 3);
  });

  it("surfaces a dashboard quota API error", async () => {
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => new Response("", { status: 502 }),
    });
    await assert.rejects(
      () => api.getDashboardQuota(),
      (error: unknown) => error instanceof ApiError && error.statusCode === 502 && !isLiveDashboardUnavailable(error),
    );
    const invalid = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    await assert.rejects(
      () => invalid.getDashboardQuota(),
      (error: unknown) => error instanceof Error && error.name === "DashboardResponseError" && !isLiveDashboardUnavailable(error),
    );
  });

  it("surfaces a dashboard message API error", async () => {
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => new Response(JSON.stringify({ message: "Unavailable", statusCode: 503 }), { status: 503 }),
    });
    await assert.rejects(
      () => api.getDashboardMessages(),
      (error: unknown) => error instanceof ApiError && error.statusCode === 503 && !isLiveDashboardUnavailable(error),
    );
  });

  it("leaves every operation except the dashboard on the unavailable fallback", async () => {
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => {
        throw new Error("dashboard was not the operation under test");
      },
    });
    await assert.rejects(() => api.listMessages({}, { role: "viewer", tenantId: null, userId: "user-1", name: "User" }), LiveApiNotConnectedError);
    await assert.rejects(() => api.createPlan({} as never), LiveApiNotConnectedError);
    assert.equal(isLiveDashboardUnavailable(new LiveApiNotConnectedError("listMessages")), true);

    const unconfigured = createLiveApi({ apiBaseUrl: null, getAccessToken: () => token });
    await assert.rejects(
      () => unconfigured.getDashboard(),
      (error: unknown) => isLiveDashboardUnavailable(error),
    );
    await assert.rejects(
      () => unconfigured.getDashboardMessages(),
      (error: unknown) => isLiveDashboardUnavailable(error),
    );
    await assert.rejects(
      () => unconfigured.getDashboardQuota(),
      (error: unknown) => isLiveDashboardUnavailable(error),
    );
    await assert.rejects(
      () => unconfigured.listPlans(),
      (error: unknown) => isLiveDashboardUnavailable(error),
    );
  });

  it("calls GET /plans with page and pageSize and does not send a tenant", async () => {
    const seen: Array<{ url: string; method: string; authorization: string | null; headerNames: string[] }> = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        seen.push({
          url: String(input),
          method: init?.method ?? "",
          authorization: headers.get("Authorization"),
          headerNames: [...headers.keys()],
        });
        return new Response(JSON.stringify({
          items: [{
            id: "11111111-1111-4111-8111-111111111111",
            code: "STANDARD",
            name: "Standard",
            description: null,
            status: "ACTIVE",
            defaultTpsLimit: 10,
            defaultQuotaPolicy: "HARD_STOP",
            features: ["API_ACCESS"],
            channels: [
              { channel: "SMS", enabled: true, monthlyQuota: 25000 },
              { channel: "WHATSAPP", enabled: false, monthlyQuota: null },
            ],
            tenants: 9,
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-02T00:00:00.000Z",
          }],
          page: 2,
          pageSize: 50,
          total: 1,
        }), { status: 200 });
      },
    });

    const page = await api.listPlans({ page: 2, pageSize: 50 });
    const request = seen[0];
    assert.ok(request);
    const url = new URL(request.url);
    assert.equal(url.pathname, "/api/v1/plans");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(url.searchParams.get("pageSize"), "50");
    assert.deepEqual([...url.searchParams.keys()], ["page", "pageSize"]);
    assert.equal(request.method, "GET");
    assert.equal(request.authorization, `Bearer ${token}`);
    assert.equal(request.headerNames.some((name) => name.toLowerCase().includes("tenant")), false);
    assert.equal(page.items[0]?.tenants, null);
    assert.equal(page.items[0]?.tpsLimit, 10);
    assert.equal(page.items[0]?.quotaPolicy, "hard_stop");
    assert.equal(page.items[0]?.entitlements[1]?.monthly, null);
  });

  it("clamps the plan page size and lets a failed list be requested again", async () => {
    const searches: string[] = [];
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input) => {
        calls += 1;
        searches.push(new URL(String(input)).search);
        if (calls === 1) return new Response("", { status: 502 });
        return new Response(JSON.stringify({ items: [], page: 1, pageSize: 100, total: 0 }), { status: 200 });
      },
    });
    await assert.rejects(
      () => api.listPlans({ pageSize: 250 }),
      (error: unknown) => error instanceof ApiError && error.statusCode === 502,
    );
    const page = await api.listPlans({ pageSize: 250 });
    assert.deepEqual(searches, ["?page=1&pageSize=100", "?page=1&pageSize=100"]);
    assert.equal(page.total, 0);
    assert.deepEqual(page.items, []);
  });
});
