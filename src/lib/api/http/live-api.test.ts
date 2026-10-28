import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./errors.ts";
import { LiveApiNotConnectedError } from "./errors.ts";
import { createLiveApi } from "./live-api.ts";
import {
  applyPlanEditRequests,
  createPlanEditRequests,
  findPlanEditConflicts,
  mergePlanEditAfterRefresh,
  PlanUpdateError,
} from "./plan-editing.ts";
import { isLiveDashboardUnavailable } from "../dashboard-availability.ts";
import type { Plan } from "../types.ts";

const base = "https://engine.example/api/v1";
const token = "test-access-token";

const createInput: Omit<Plan, "id" | "tenants"> = {
  code: "GROWTH",
  name: "Growth",
  description: "A growth plan",
  status: "draft",
  tpsLimit: 25,
  quotaPolicy: "soft_cap",
  features: ["api_access", "webhooks"],
  entitlements: [
    { channel: "sms", enabled: true, monthly: 1000 },
    { channel: "whatsapp", enabled: false, monthly: 0 },
  ],
};

const editablePlan: Plan = {
  ...createInput,
  id: "33333333-3333-4333-8333-333333333333",
  tenants: null,
  entitlements: [
    { channel: "sms", enabled: true, monthly: 100 },
    { channel: "whatsapp", enabled: false, monthly: null },
    { channel: "email", enabled: false, monthly: null },
  ],
};

const apiFeatures: Record<Plan["features"][number], string> = {
  api_access: "API_ACCESS",
  bulk_messaging: "BULK_MESSAGING",
  webhooks: "WEBHOOKS",
  reporting: "REPORTING",
  audit_export: "AUDIT_EXPORT",
  dedicated_sender_identities: "DEDICATED_SENDER_IDENTITIES",
};

function planResponse(plan: Plan) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    status: plan.status.toUpperCase(),
    defaultTpsLimit: plan.tpsLimit,
    defaultQuotaPolicy: plan.quotaPolicy === "hard_stop" ? "HARD_STOP" : "SOFT_CAP",
    features: plan.features.map((feature) => apiFeatures[feature]),
    channels: plan.entitlements.map((item) => ({
      channel: item.channel.toUpperCase(),
      enabled: item.enabled,
      monthlyQuota: item.enabled ? item.monthly : null,
    })),
  };
}

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

  it("reads a selected tenant quota through the platform-authorized endpoint", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    let requested = "";
    const reading = { used: 4, committed: 3, reserved: 1, ceiling: 20, band: "NONE", overage: 0 };
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        requested = String(input);
        assert.equal(init?.method, "GET");
        assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token}`);
        return new Response(JSON.stringify({ scope: "tenant", tenantId, periodStart: "2026-10-01", configured: true, policy: "SOFT_CAP", policySource: "subscription", aggregate: reading, channels: [{ channel: "EMAIL", enabled: true, ...reading }] }));
      },
    });
    const quota = await api.getDashboardQuota(tenantId);
    assert.equal(new URL(requested).pathname, `/api/v1/tenants/${tenantId}/dashboard/quota`);
    assert.equal(quota.scope, "tenant");
    if (quota.scope === "tenant") {
      assert.equal(quota.policySource, "subscription");
      assert.equal(quota.channels[0]?.ceiling, 20);
    }
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

  it("leaves unrelated operations unavailable and requires a baseline for live plan edits", async () => {
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => {
        throw new Error("dashboard was not the operation under test");
      },
    });
    await assert.rejects(() => api.listMessages({}, { role: "viewer", tenantId: null, userId: "user-1", name: "User" }), LiveApiNotConnectedError);
    await assert.rejects(
      () => api.updatePlan("plan-1", {} as never),
      (error: unknown) => error instanceof Error && error.name === "PlanCatalogError",
    );
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
    await assert.rejects(() => unconfigured.createPlan(createInput), LiveApiNotConnectedError);
    await assert.rejects(() => unconfigured.updatePlan("plan-1", {} as never), LiveApiNotConnectedError);
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

  it("posts the plan DTO with bearer JSON headers and maps the created plan", async () => {
    const seen: Array<{ url: string; method: string; authorization: string | null; contentType: string | null; headerNames: string[]; body: unknown }> = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        seen.push({
          url: String(input),
          method: init?.method ?? "",
          authorization: headers.get("Authorization"),
          contentType: headers.get("Content-Type"),
          headerNames: [...headers.keys()],
          body: JSON.parse(String(init?.body)),
        });
        return new Response(JSON.stringify({
          id: "22222222-2222-4222-8222-222222222222",
          code: "GROWTH",
          name: "Growth",
          description: "A growth plan",
          status: "DRAFT",
          defaultTpsLimit: 25,
          defaultQuotaPolicy: "SOFT_CAP",
          features: ["API_ACCESS", "WEBHOOKS"],
          channels: [
            { channel: "SMS", enabled: true, monthlyQuota: 1000 },
            { channel: "WHATSAPP", enabled: false, monthlyQuota: null },
          ],
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        }), { status: 201 });
      },
    });

    const created = await api.createPlan(createInput);
    const request = seen[0];
    assert.ok(request);
    assert.equal(request.url, `${base}/plans`);
    assert.equal(request.method, "POST");
    assert.equal(request.authorization, `Bearer ${token}`);
    assert.equal(request.contentType, "application/json");
    assert.equal(request.headerNames.some((name) => name.toLowerCase().includes("tenant")), false);
    assert.deepEqual(request.body, {
      code: "GROWTH",
      name: "Growth",
      description: "A growth plan",
      status: "DRAFT",
      defaultTpsLimit: 25,
      defaultQuotaPolicy: "SOFT_CAP",
      features: ["API_ACCESS", "WEBHOOKS"],
      channels: [
        { channel: "SMS", enabled: true, monthlyQuota: 1000 },
        { channel: "WHATSAPP", enabled: false, monthlyQuota: null },
      ],
    });
    assert.equal("tenantId" in (request.body as Record<string, unknown>), false);
    assert.equal(created.id, "22222222-2222-4222-8222-222222222222");
    assert.equal(created.tenants, null);
    assert.equal(created.status, "draft");
  });

  it("surfaces validation and conflict errors without retrying plan creation", async () => {
    for (const response of [
      { status: 400, message: ["name must be shorter than or equal to 120 characters"] },
      { status: 409, message: "Plan code is already in use" },
    ]) {
      let calls = 0;
      const api = createLiveApi({
        apiBaseUrl: base,
        getAccessToken: () => token,
        fetchImpl: async () => {
          calls += 1;
          return new Response(JSON.stringify({
            statusCode: response.status,
            error: response.status === 400 ? "Bad Request" : "Conflict",
            message: response.message,
          }), { status: response.status });
        },
      });
      await assert.rejects(
        () => api.createPlan(createInput),
        (error: unknown) => error instanceof ApiError && error.statusCode === response.status,
      );
      assert.equal(calls, 1);
    }
  });

  it("rejects an inactive plan before sending a live create request", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => {
        calls += 1;
        return new Response("{}", { status: 201 });
      },
    });
    await assert.rejects(
      () => api.createPlan({ ...createInput, status: "inactive" }),
      (error: unknown) => error instanceof Error && error.name === "PlanCatalogError",
    );
    assert.equal(calls, 0);
  });

  it("posts each plan lifecycle status to the dedicated endpoint with bearer JSON headers", async () => {
    const seen: Array<{
      url: string;
      method: string;
      authorization: string | null;
      contentType: string | null;
      headerNames: string[];
      body: unknown;
    }> = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        seen.push({
          url: String(input),
          method: init?.method ?? "",
          authorization: headers.get("Authorization"),
          contentType: headers.get("Content-Type"),
          headerNames: [...headers.keys()],
          body: JSON.parse(String(init?.body)),
        });
        return new Response("{}", { status: 200 });
      },
    });

    for (const [status, apiStatus] of [
      ["draft", "DRAFT"],
      ["active", "ACTIVE"],
      ["inactive", "INACTIVE"],
      ["archived", "ARCHIVED"],
    ] as const) {
      await api.setPlanStatus(editablePlan.id, status);
      const request = seen.at(-1);
      assert.ok(request);
      assert.equal(request.url, `${base}/plans/${editablePlan.id}/status`);
      assert.equal(request.method, "POST");
      assert.equal(request.authorization, `Bearer ${token}`);
      assert.equal(request.contentType, "application/json");
      assert.equal(request.headerNames.some((name) => name.toLowerCase().includes("tenant")), false);
      assert.deepEqual(request.body, { status: apiStatus });
    }
    assert.equal(seen.length, 4);
  });

  it("surfaces rejected lifecycle transitions and API failures without retrying", async () => {
    for (const statusCode of [400, 409, 502]) {
      let calls = 0;
      const api = createLiveApi({
        apiBaseUrl: base,
        getAccessToken: () => token,
        fetchImpl: async () => {
          calls += 1;
          return new Response(JSON.stringify({
            statusCode,
            error: statusCode === 409 ? "Conflict" : "Bad Request",
            message: statusCode === 409
              ? "The plan status change is not allowed"
              : "status must be a valid enum value",
          }), { status: statusCode });
        },
      });
      await assert.rejects(
        () => api.setPlanStatus(editablePlan.id, "active"),
        (error: unknown) => error instanceof ApiError && error.statusCode === statusCode,
      );
      assert.equal(calls, 1);
    }
  });

  it("updates only changed plan fields in endpoint order with the expected HTTP contracts", async () => {
    let serverPlan = editablePlan;
    const seen: Array<{ method: string; path: string; headers: Headers; body?: Record<string, unknown> }> = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        const headers = new Headers(init?.headers);
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
        seen.push({ method, path: url.pathname + url.search, headers, ...(body ? { body } : {}) });
        if (method === "PATCH") {
          serverPlan = { ...serverPlan, ...body };
        } else if (url.pathname.endsWith("/commercial-terms")) {
          serverPlan = {
            ...serverPlan,
            ...(typeof body?.["defaultTpsLimit"] === "number" ? { tpsLimit: body["defaultTpsLimit"] } : {}),
            ...(body?.["defaultQuotaPolicy"] === "HARD_STOP" ? { quotaPolicy: "hard_stop" as const } : {}),
          };
        } else if (url.pathname.endsWith("/features")) {
          const features = body?.["features"] as string[];
          serverPlan = { ...serverPlan, features: features.map((feature) => Object.entries(apiFeatures).find(([, value]) => value === feature)?.[0] as Plan["features"][number]) };
        } else if (url.pathname.includes("/channels/")) {
          const channel = url.pathname.slice(url.pathname.lastIndexOf("/") + 1).toLowerCase() as Plan["entitlements"][number]["channel"];
          const entitlement = {
            channel,
            enabled: body?.["enabled"] === true,
            monthly: body?.["enabled"] === true ? body?.["monthlyQuota"] as number : null,
          };
          serverPlan = {
            ...serverPlan,
            entitlements: serverPlan.entitlements.map((item) => item.channel === channel ? entitlement : item),
          };
        }
        return new Response(JSON.stringify(planResponse(serverPlan)), { status: 200 });
      },
    });

    const updatedInput: Omit<Plan, "id" | "tenants"> = {
      ...editablePlan,
      name: "Growth Plus",
      description: "Updated description",
      status: "inactive",
      tpsLimit: 40,
      quotaPolicy: "hard_stop",
      features: ["api_access", "reporting"],
      entitlements: [
        { channel: "sms", enabled: false, monthly: null },
        { channel: "whatsapp", enabled: true, monthly: 42 },
        { channel: "email", enabled: false, monthly: null },
      ],
    };

    const updated = await api.updatePlan(editablePlan.id, updatedInput, editablePlan);

    assert.deepEqual(seen.map(({ method, path }) => [method, path]), [
      ["GET", `/api/v1/plans/${editablePlan.id}`],
      ["PATCH", `/api/v1/plans/${editablePlan.id}`],
      ["PUT", `/api/v1/plans/${editablePlan.id}/commercial-terms`],
      ["PUT", `/api/v1/plans/${editablePlan.id}/features`],
      ["PUT", `/api/v1/plans/${editablePlan.id}/channels/SMS`],
      ["PUT", `/api/v1/plans/${editablePlan.id}/channels/WHATSAPP`],
    ]);
    assert.deepEqual(seen.slice(1).map((request) => request.body), [
      { name: "Growth Plus", description: "Updated description" },
      { defaultTpsLimit: 40, defaultQuotaPolicy: "HARD_STOP" },
      { features: ["API_ACCESS", "REPORTING"] },
      { enabled: false, monthlyQuota: null },
      { enabled: true, monthlyQuota: 42 },
    ]);
    for (const request of seen) {
      assert.equal(request.headers.get("Authorization"), `Bearer ${token}`);
      assert.equal([...request.headers.keys()].some((name) => name.toLowerCase().includes("tenant")), false);
    }
    for (const request of seen.slice(1)) {
      assert.equal(request.headers.get("Content-Type"), "application/json");
    }
    assert.equal(updated.name, "Growth Plus");
    assert.equal(updated.status, "draft");
    assert.equal(updated.tenants, null);
  });

  it("performs only a preflight read for a no-op edit", async () => {
    const methods: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (_input, init) => {
        methods.push(init?.method ?? "GET");
        return new Response(JSON.stringify(planResponse(editablePlan)), { status: 200 });
      },
    });
    const updated = await api.updatePlan(editablePlan.id, editablePlan, editablePlan);
    assert.deepEqual(methods, ["GET"]);
    assert.equal(updated.id, editablePlan.id);
  });

  it("stops after the first failed endpoint, refreshes, and retries only remaining differences", async () => {
    const draft: Plan = {
      ...editablePlan,
      name: "Growth Plus",
      tpsLimit: 50,
      features: ["api_access", "webhooks", "reporting"],
    };
    let latest = editablePlan;
    const calls: string[] = [];
    const requests = createPlanEditRequests(editablePlan.id, editablePlan, draft);
    let error: PlanUpdateError | undefined;
    try {
      await applyPlanEditRequests(
        editablePlan,
        draft,
        requests,
        async (request) => {
          calls.push(request.path);
          if (request.method === "PATCH") {
            latest = { ...latest, ...request.body };
            return latest;
          }
          throw new Error("commercial terms rejected");
        },
        async () => latest,
      );
    } catch (cause) {
      assert.ok(cause instanceof PlanUpdateError);
      error = cause;
    }

    assert.ok(error);
    assert.deepEqual(calls, [`/plans/${editablePlan.id}`, `/plans/${editablePlan.id}/commercial-terms`]);
    assert.deepEqual(error.confirmedValues.name, "Growth Plus");
    assert.equal(error.latest?.name, "Growth Plus");
    const retainedDraft = mergePlanEditAfterRefresh(error.original, error.draft, error.latest!);
    assert.deepEqual(createPlanEditRequests(editablePlan.id, error.latest!, retainedDraft).map((request) => request.fields), [
      ["tpsLimit"],
      ["features"],
    ]);
  });

  it("flags an acknowledged edit reverted to the original value for review", async () => {
    const draft = { ...editablePlan, name: "Growth Plus", tpsLimit: 50 };
    const requests = createPlanEditRequests(editablePlan.id, editablePlan, draft);
    const conflicts = findPlanEditConflicts(
      editablePlan,
      draft,
      editablePlan,
      { name: "Growth Plus" },
    );
    assert.deepEqual(conflicts, ["name"]);

    let refreshCount = 0;
    await assert.rejects(
      () => applyPlanEditRequests(
        editablePlan,
        draft,
        requests,
        async (request) => {
          if (request.method === "PATCH") return { ...editablePlan, name: draft.name };
          throw new Error("commercial terms rejected");
        },
        async () => {
          refreshCount += 1;
          return editablePlan;
        },
      ),
      (error: unknown) =>
        error instanceof PlanUpdateError &&
        error.confirmedValues.name === draft.name &&
        error.latest?.name === editablePlan.name &&
        error.conflicts.includes("name"),
    );
    assert.equal(refreshCount, 2);
  });

  it("does not resolve when a later successful response contradicts an earlier acknowledgement", async () => {
    const draft: Plan = {
      ...editablePlan,
      name: "Growth Plus",
      tpsLimit: 50,
      features: ["api_access", "reporting"],
    };
    const requests = createPlanEditRequests(editablePlan.id, editablePlan, draft);
    const calls: string[] = [];
    let refreshCount = 0;
    await assert.rejects(
      () => applyPlanEditRequests(
        editablePlan,
        draft,
        requests,
        async (request) => {
          calls.push(request.path);
          if (request.method === "PATCH") return { ...editablePlan, name: draft.name };
          if (request.path.endsWith("/commercial-terms")) {
            return { ...editablePlan, tpsLimit: draft.tpsLimit };
          }
          return draft;
        },
        async () => {
          refreshCount += 1;
          return refreshCount === 1
            ? editablePlan
            : { ...editablePlan, tpsLimit: draft.tpsLimit };
        },
      ),
      (error: unknown) =>
        error instanceof PlanUpdateError &&
        error.confirmedValues.name === draft.name &&
        error.confirmedValues.tpsLimit === draft.tpsLimit &&
        error.latest?.name === editablePlan.name &&
        error.conflicts.includes("name"),
    );
    assert.deepEqual(calls, [
      `/plans/${editablePlan.id}`,
      `/plans/${editablePlan.id}/commercial-terms`,
    ]);
    assert.equal(refreshCount, 2);
  });

  it("preserves mandatory review when recovery matches an earlier acknowledgement, then retries from refreshed state", async () => {
    const draft: Plan = {
      ...editablePlan,
      name: "Growth Plus",
      tpsLimit: 50,
      features: ["api_access", "reporting"],
    };
    const requests = createPlanEditRequests(editablePlan.id, editablePlan, draft);
    const firstAttemptWrites: string[] = [];
    let refreshCount = 0;
    let partial: PlanUpdateError | undefined;

    try {
      await applyPlanEditRequests(
        editablePlan,
        draft,
        requests,
        async (request) => {
          firstAttemptWrites.push(request.path);
          if (request.method === "PATCH") return { ...editablePlan, name: draft.name };
          return { ...editablePlan, tpsLimit: draft.tpsLimit };
        },
        async () => {
          refreshCount += 1;
          return refreshCount === 1
            ? editablePlan
            : { ...editablePlan, name: draft.name };
        },
      );
      assert.fail("A contradictory response must not resolve as a successful edit.");
    } catch (error) {
      assert.ok(error instanceof PlanUpdateError);
      partial = error;
    }

    assert.ok(partial?.latest);
    assert.deepEqual(firstAttemptWrites, [
      `/plans/${editablePlan.id}`,
      `/plans/${editablePlan.id}/commercial-terms`,
    ]);
    assert.equal(partial.latest.name, draft.name);
    assert.deepEqual(partial.reviewRequiredFields, ["name"]);
    assert.ok(partial.conflicts.includes("name"));
    assert.ok(partial.conflicts.length > 0, "The route save guard must remain active pending explicit review.");

    const refreshedBaseline = partial.latest;
    const retainedDraft = mergePlanEditAfterRefresh(partial.original, partial.draft, refreshedBaseline);
    assert.equal(retainedDraft.name, draft.name);
    assert.equal(retainedDraft.tpsLimit, draft.tpsLimit);

    const retryWrites: string[] = [];
    const updated = await applyPlanEditRequests(
      refreshedBaseline,
      retainedDraft,
      createPlanEditRequests(editablePlan.id, refreshedBaseline, retainedDraft),
      async (request) => {
        retryWrites.push(request.path);
        if (request.path.endsWith("/commercial-terms")) {
          return { ...refreshedBaseline, tpsLimit: draft.tpsLimit };
        }
        return { ...refreshedBaseline, tpsLimit: draft.tpsLimit, features: draft.features };
      },
      async () => refreshedBaseline,
    );
    assert.deepEqual(retryWrites, [
      `/plans/${editablePlan.id}/commercial-terms`,
      `/plans/${editablePlan.id}/features`,
    ]);
    assert.equal(updated.name, draft.name);
    assert.equal(updated.tpsLimit, draft.tpsLimit);
    assert.deepEqual(updated.features, draft.features);
  });

  it("flags an unacknowledged server value matching the draft as a concurrent conflict", async () => {
    const draft = { ...editablePlan, name: "Growth Plus" };
    const requests = createPlanEditRequests(editablePlan.id, editablePlan, draft);
    let sends = 0;
    await assert.rejects(
      () => applyPlanEditRequests(
        editablePlan,
        draft,
        requests,
        async () => {
          sends += 1;
          return draft;
        },
        async () => ({ ...editablePlan, name: "Growth Plus" }),
      ),
      (error: unknown) => error instanceof PlanUpdateError &&
        error.latest?.name === draft.name &&
        error.conflicts.includes("name"),
    );
    assert.equal(sends, 0);
  });

  it("requires review when a concurrent edit changes a previously acknowledged field", async () => {
    const draft: Plan = { ...editablePlan, name: "Growth Plus", tpsLimit: 50 };
    const requests = createPlanEditRequests(editablePlan.id, editablePlan, draft);
    let latest = editablePlan;
    let refreshCount = 0;
    await assert.rejects(
      () => applyPlanEditRequests(
        editablePlan,
        draft,
        requests,
        async (request) => {
          if (request.method === "PATCH") {
            latest = { ...latest, name: draft.name };
            return latest;
          }
          throw new Error("commercial terms rejected");
        },
        async () => {
          refreshCount += 1;
          return refreshCount === 1 ? editablePlan : { ...latest, name: "Another administrator's name" };
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof PlanUpdateError);
        assert.equal(error.confirmedValues.name, draft.name, String(error.failure));
        assert.ok(error.conflicts.includes("name"));
        assert.equal(error.latest?.name, "Another administrator's name");
        return true;
      },
    );
  });

  it("blocks retry when the post-failure refresh also fails and does not retry a mutation", async () => {
    const draft = { ...editablePlan, name: "Growth Plus" };
    let reads = 0;
    let writes = 0;
    await assert.rejects(
      () => applyPlanEditRequests(
        editablePlan,
        draft,
        createPlanEditRequests(editablePlan.id, editablePlan, draft),
        async () => {
          writes += 1;
          throw new Error("network outcome unknown");
        },
        async () => {
          reads += 1;
          if (reads > 1) throw new Error("refresh unavailable");
          return editablePlan;
        },
      ),
      (error: unknown) => error instanceof PlanUpdateError &&
        error.latest === null &&
        error.refreshFailure instanceof Error,
    );
    assert.equal(reads, 2);
    assert.equal(writes, 1);
  });
});
