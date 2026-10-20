import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError, LiveApiNotConnectedError } from "./errors.ts";
import { createLiveApi } from "./live-api.ts";

const base = "https://engine.example/api/v1";
const assignmentTenantId = "11111111-1111-4111-8111-111111111111";
const assignmentPlanId = "22222222-2222-4222-8222-222222222222";
const assignmentSubscriptionId = "33333333-3333-4333-8333-333333333333";
const assignmentTimestamp = "2026-10-01T00:00:00.000Z";

function planAssignmentResponse(
  status: "TRIAL" | "ACTIVE" = "ACTIVE",
  overrides: {
    tenantId?: string;
    planId?: string;
    effectivePlanId?: string;
  } = {},
) {
  const planId = overrides.planId ?? assignmentPlanId;
  return {
    subscription: {
      id: assignmentSubscriptionId,
      tenantId: overrides.tenantId ?? assignmentTenantId,
      planId,
      status,
      startsAt: assignmentTimestamp,
      endsAt: null,
      tpsLimitOverride: null,
      quotaPolicyOverride: null,
      channelOverrides: [],
      plan: {
        id: planId,
        code: "GOLD",
        name: "Gold",
        description: null,
        status: "ACTIVE",
        defaultTpsLimit: 20,
        defaultQuotaPolicy: "HARD_STOP",
        features: ["API_ACCESS"],
        channels: [
          { channel: "SMS", enabled: true, monthlyQuota: 1000 },
          { channel: "WHATSAPP", enabled: false, monthlyQuota: null },
          { channel: "EMAIL", enabled: true, monthlyQuota: 500 },
        ],
        createdAt: assignmentTimestamp,
        updatedAt: assignmentTimestamp,
      },
      createdAt: assignmentTimestamp,
      updatedAt: assignmentTimestamp,
    },
    effective: {
      tenantId: overrides.tenantId ?? assignmentTenantId,
      tenantStatus: "ACTIVE",
      subscriptionId: assignmentSubscriptionId,
      planId: overrides.effectivePlanId ?? planId,
      configured: true,
      operational: true,
      blockers: [],
      quotaPolicy: "HARD_STOP",
      quotaPolicySource: "plan",
      tpsLimit: 20,
      tpsSource: "plan",
      features: ["API_ACCESS"],
      channels: [
        { channel: "SMS", enabled: true, monthlyQuota: 1000, tpsLimit: 20, quotaSource: "plan", tpsSource: "plan", ignoredOverride: false },
        { channel: "WHATSAPP", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
        { channel: "EMAIL", enabled: true, monthlyQuota: 500, tpsLimit: 20, quotaSource: "plan", tpsSource: "plan", ignoredOverride: false },
      ],
    },
  };
}

describe("live tenant catalog API", () => {
  it("requests only supported pagination and maps the basic tenant DTO", async () => {
    let request: { url: string; method: string; hasBearerAuthorization: boolean; headerNames: string[] } | undefined;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        request = {
          url: String(input),
          method: init?.method ?? "",
          hasBearerAuthorization: headers.get("Authorization") === "Bearer test-access-token",
          headerNames: [...headers.keys()],
        };
        return new Response(JSON.stringify({
          items: [{
            id: "11111111-1111-4111-8111-111111111111",
            code: "ACME",
            name: "Acme",
            status: "ACTIVE",
            dataRegion: "me-central",
            defaultLanguage: "EN",
            timezone: "Asia/Riyadh",
            notes: null,
            primaryAdminUserId: null,
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-02T00:00:00.000Z",
          }],
          page: 2,
          pageSize: 20,
          total: 21,
        }), { status: 200 });
      },
    });

    const page = await api.listTenants({
      page: 2,
      pageSize: 20,
      search: "ignored",
      filters: { status: "active" },
      sortBy: "name",
      sortDirection: "desc",
    });

    assert.deepEqual(request, {
      url: `${base}/tenants?page=2&pageSize=20`,
      method: "GET",
      hasBearerAuthorization: true,
      headerNames: ["accept", "authorization"],
    });
    assert.deepEqual(page, {
      items: [{
        id: "11111111-1111-4111-8111-111111111111",
        code: "ACME",
        name: "Acme",
        status: "active",
        dataRegion: "me-central",
        defaultLanguage: "en",
        timezone: "Asia/Riyadh",
        notes: null,
        primaryAdminUserId: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-02T00:00:00.000Z",
      }],
      page: 2,
      pageSize: 20,
      total: 21,
    });
    assert.equal("subscription" in page.items[0]!, false);
    assert.equal("planName" in page.items[0]!, false);
    assert.equal("users" in page.items[0]!, false);
  });

  it("propagates HTTP errors without mock fallback", async () => {
    let calls = 0;
    const live = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({
          statusCode: 502,
          error: "Bad Gateway",
          message: "Tenant catalog unavailable",
        }), { status: 502 });
      },
    });
    await assert.rejects(
      () => live.listTenants({ page: 1, pageSize: 10 }),
      (error: unknown) => error instanceof ApiError && error.statusCode === 502,
    );
    assert.equal(calls, 1);

    const unavailable = createLiveApi({ apiBaseUrl: null, getAccessToken: () => null });
    await assert.rejects(
      () => unavailable.listTenants({ page: 1, pageSize: 10 }),
      LiveApiNotConnectedError,
    );
  });

  it("gets a tenant detail through the authenticated human client without tenant headers", async () => {
    let request: { url: string; method: string; hasBearerAuthorization: boolean; headerNames: string[] } | undefined;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        request = {
          url: String(input),
          method: init?.method ?? "",
          hasBearerAuthorization: headers.get("Authorization")?.startsWith("Bearer ") ?? false,
          headerNames: [...headers.keys()],
        };
        return new Response(JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          code: "ACME",
          name: "Acme",
          status: "ACTIVE",
          dataRegion: "me-central",
          defaultLanguage: "EN",
          timezone: "Asia/Riyadh",
          notes: null,
          primaryAdminUserId: null,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
        }), { status: 200 });
      },
    });

    const tenant = await api.getTenant("11111111-1111-4111-8111-111111111111");

    assert.deepEqual(request, {
      url: `${base}/tenants/11111111-1111-4111-8111-111111111111`,
      method: "GET",
      hasBearerAuthorization: true,
      headerNames: ["accept", "authorization"],
    });
    assert.equal(tenant.primaryAdminUserId, null);
    assert.equal("subscription" in tenant, false);
    assert.equal("primaryAdministrator" in tenant, false);
  });

  it("propagates tenant detail HTTP and malformed response failures", async () => {
    const httpErrorApi = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => new Response(JSON.stringify({
        statusCode: 404,
        error: "Not Found",
        message: "Tenant not found",
      }), { status: 404 }),
    });
    await assert.rejects(
      () => httpErrorApi.getTenant("11111111-1111-4111-8111-111111111111"),
      (error: unknown) => error instanceof ApiError && error.statusCode === 404,
    );

    const malformedApi = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => new Response(JSON.stringify({ id: "missing" }), { status: 200 }),
    });
    await assert.rejects(() => malformedApi.getTenant("11111111-1111-4111-8111-111111111111"));
  });

  it("creates a tenant with the mapped DTO through the authenticated JSON client", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const adminId = "22222222-2222-4222-8222-222222222222";
    const createdAt = "2026-10-18T00:00:00.000Z";
    let request: {
      url: string;
      method: string;
      hasBearerAuthorization: boolean;
      contentType: string | null;
      headerNames: string[];
      body: unknown;
    } | undefined;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        request = {
          url: String(input),
          method: init?.method ?? "",
          hasBearerAuthorization: headers.get("Authorization")?.startsWith("Bearer ") ?? false,
          contentType: headers.get("Content-Type"),
          headerNames: [...headers.keys()],
          body: JSON.parse(String(init?.body)),
        };
        return new Response(JSON.stringify({
          tenant: {
            id: tenantId,
            code: "ACME",
            name: "Acme",
            status: "TRIAL",
            dataRegion: "me-central",
            defaultLanguage: "AR",
            timezone: "Asia/Riyadh",
            notes: null,
            primaryAdminUserId: adminId,
            createdAt,
            updatedAt: createdAt,
          },
          primaryAdmin: {
            id: adminId,
            tenantId,
            email: "admin@example.com",
            firstName: "Amina",
            lastName: "Hassan",
            firstNameAr: "أمينة",
            lastNameAr: "حسن",
            mobile: "+966500000000",
            jobTitle: null,
            department: null,
            preferredLanguage: "AR",
            role: "CLIENT_ADMIN",
            status: "INVITED",
            createdAt,
            updatedAt: createdAt,
          },
        }), { status: 201 });
      },
    });

    const response = await api.createTenant({
      code: "ACME",
      name: "Acme",
      status: "trial",
      region: "unsupported-region",
      dataRegion: "me-central",
      defaultLanguage: "ar",
      timezone: "Asia/Riyadh",
      notes: "",
      planId: "unsupported-plan-id",
      overrides: { tpsLimit: 12 },
      primaryAdministrator: {
        email: "admin@example.com",
        firstName: "Amina",
        lastName: "Hassan",
        firstNameArabic: "أمينة",
        lastNameArabic: "حسن",
        mobileNumber: "+966500000000",
        jobTitle: "Unsupported title",
        department: "Unsupported department",
        preferredLanguage: "ar",
      },
    });

    assert.deepEqual(request, {
      url: `${base}/tenants`,
      method: "POST",
      hasBearerAuthorization: true,
      contentType: "application/json",
      headerNames: ["accept", "authorization", "content-type"],
      body: {
        code: "ACME",
        name: "Acme",
        dataRegion: "me-central",
        status: "TRIAL",
        defaultLanguage: "AR",
        timezone: "Asia/Riyadh",
        primaryAdmin: {
          email: "admin@example.com",
          firstName: "Amina",
          lastName: "Hassan",
          firstNameAr: "أمينة",
          lastNameAr: "حسن",
          mobile: "+966500000000",
          preferredLanguage: "AR",
        },
      },
    });
    assert.ok("tenant" in response);
    assert.equal(response.tenant.status, "trial");
    assert.equal(response.primaryAdmin?.status, "invited");
    assert.equal("subscription" in response.tenant, false);
  });

  it("rejects malformed tenant-create responses", async () => {
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => new Response(JSON.stringify({ tenant: {}, primaryAdmin: null }), { status: 201 }),
    });
    await assert.rejects(() => api.createTenant({
      code: "ACME",
      name: "Acme",
      status: "trial",
      region: "region",
      dataRegion: "me-central",
      defaultLanguage: "en",
      timezone: "Asia/Riyadh",
      notes: "",
      planId: "",
      overrides: null,
      primaryAdministrator: {
        email: "admin@example.com",
        firstName: "Amina",
        lastName: "Hassan",
        preferredLanguage: "en",
      },
    }));
  });

  it("propagates create authorization, validation, and conflict errors without retry", async () => {
    for (const statusCode of [400, 403, 409]) {
      let calls = 0;
      const api = createLiveApi({
        apiBaseUrl: base,
        getAccessToken: () => "test-access-token",
        fetchImpl: async () => {
          calls += 1;
          return new Response(JSON.stringify({
            statusCode,
            error: statusCode === 409 ? "Conflict" : "Request rejected",
            message: "The request was rejected",
          }), { status: statusCode });
        },
      });
      await assert.rejects(
        () => api.createTenant({
          code: "ACME",
          name: "Acme",
          status: "trial",
          region: "region",
          dataRegion: "me-central",
          defaultLanguage: "en",
          timezone: "Asia/Riyadh",
          notes: "",
          planId: "",
          overrides: null,
          primaryAdministrator: {
            email: "admin@example.com",
            firstName: "Amina",
            lastName: "Hassan",
            preferredLanguage: "en",
          },
        }),
        (error: unknown) => error instanceof ApiError && error.statusCode === statusCode,
      );
      assert.equal(calls, 1);
    }
  });

  it("patches only tenant profile fields through the authenticated client and maps the response", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    let request: {
      url: string;
      method: string;
      hasBearerAuthorization: boolean;
      contentType: string | null;
      headerNames: string[];
      body: unknown;
    } | undefined;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        request = {
          url: String(input),
          method: init?.method ?? "",
          hasBearerAuthorization: headers.get("Authorization")?.startsWith("Bearer ") ?? false,
          contentType: headers.get("Content-Type"),
          headerNames: [...headers.keys()],
          body: JSON.parse(String(init?.body)),
        };
        return new Response(JSON.stringify({
          id: tenantId,
          code: "ACME",
          name: "Acme Updated",
          status: "ACTIVE",
          dataRegion: "me-central",
          defaultLanguage: "AR",
          timezone: "Asia/Riyadh",
          notes: null,
          primaryAdminUserId: null,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
        }), { status: 200 });
      },
    });

    const updated = await api.updateTenantProfile(tenantId, {
      name: " Acme Updated ",
      notes: " ",
      defaultLanguage: "ar",
      timezone: " Asia/Riyadh ",
    });

    assert.deepEqual(request, {
      url: `${base}/tenants/${tenantId}`,
      method: "PATCH",
      hasBearerAuthorization: true,
      contentType: "application/json",
      headerNames: ["accept", "authorization", "content-type"],
      body: {
        name: "Acme Updated",
        notes: null,
        defaultLanguage: "AR",
        timezone: "Asia/Riyadh",
      },
    });
    assert.deepEqual(updated, {
      id: tenantId,
      code: "ACME",
      name: "Acme Updated",
      status: "active",
      dataRegion: "me-central",
      defaultLanguage: "ar",
      timezone: "Asia/Riyadh",
      notes: null,
      primaryAdminUserId: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
  });

  it("rejects malformed profile responses and propagates profile HTTP errors without retry", async () => {
    const malformedApi = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => new Response(JSON.stringify({ id: "invalid" }), { status: 200 }),
    });
    await assert.rejects(
      () => malformedApi.updateTenantProfile("11111111-1111-4111-8111-111111111111", { name: "Acme" }),
    );

    for (const statusCode of [400, 403, 404, 409, 500]) {
      let calls = 0;
      const api = createLiveApi({
        apiBaseUrl: base,
        getAccessToken: () => "test-access-token",
        fetchImpl: async () => {
          calls += 1;
          return new Response(JSON.stringify({
            statusCode,
            error: "Request rejected",
            message: "Request rejected",
          }), { status: statusCode });
        },
      });
      await assert.rejects(
        () => api.updateTenantProfile("11111111-1111-4111-8111-111111111111", { name: "Acme" }),
        (error: unknown) => error instanceof ApiError && error.statusCode === statusCode,
      );
      assert.equal(calls, 1);
    }
  });

  it("changes tenant status through the authenticated status endpoint for every supported status", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const statuses = [
      ["trial", "TRIAL"],
      ["active", "ACTIVE"],
      ["suspended", "SUSPENDED"],
      ["inactive", "INACTIVE"],
    ] as const;
    const requests: {
      url: string;
      method: string;
      hasBearerAuthorization: boolean;
      contentType: string | null;
      headerNames: string[];
      body: unknown;
    }[] = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        const body = JSON.parse(String(init?.body)) as { status: string };
        requests.push({
          url: String(input),
          method: init?.method ?? "",
          hasBearerAuthorization: headers.get("Authorization")?.startsWith("Bearer ") ?? false,
          contentType: headers.get("Content-Type"),
          headerNames: [...headers.keys()],
          body,
        });
        return new Response(JSON.stringify({
          id: tenantId,
          code: "ACME",
          name: "Acme",
          status: body.status,
          dataRegion: "me-central",
          defaultLanguage: "EN",
          timezone: "Asia/Riyadh",
          notes: null,
          primaryAdminUserId: null,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
        }), { status: 200 });
      },
    });

    for (const [status] of statuses) {
      await api.setTenantStatus(tenantId, status);
    }

    assert.deepEqual(requests, statuses.map(([, apiStatus]) => ({
      url: `${base}/tenants/${tenantId}/status`,
      method: "POST",
      hasBearerAuthorization: true,
      contentType: "application/json",
      headerNames: ["accept", "authorization", "content-type"],
      body: { status: apiStatus },
    })));
  });

  it("rejects invalid tenant IDs and malformed or mismatched status responses", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          code: "ACME",
          name: "Acme",
          status: "ACTIVE",
          dataRegion: "me-central",
          defaultLanguage: "EN",
          timezone: "Asia/Riyadh",
          notes: null,
          primaryAdminUserId: null,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
        }), { status: 200 });
      },
    });

    await assert.rejects(() => api.setTenantStatus("not-a-uuid", "active"));
    assert.equal(calls, 0);
    await assert.rejects(() => api.setTenantStatus("22222222-2222-4222-8222-222222222222", "active"));
    assert.equal(calls, 1);

    const malformedApi = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => new Response(JSON.stringify({ id: "invalid" }), { status: 200 }),
    });
    await assert.rejects(
      () => malformedApi.setTenantStatus("11111111-1111-4111-8111-111111111111", "active"),
    );
  });

  it("rejects a valid response when the returned status differs from the requested status", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => new Response(JSON.stringify({
        id: tenantId,
        code: "ACME",
        name: "Acme",
        status: "TRIAL",
        dataRegion: "me-central",
        defaultLanguage: "EN",
        timezone: "Asia/Riyadh",
        notes: null,
        primaryAdminUserId: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-02T00:00:00.000Z",
      }), { status: 200 }),
    });

    await assert.rejects(
      () => api.setTenantStatus(tenantId, "active"),
      (error: unknown) => error instanceof Error &&
        error.message === "Tenant status response does not match the requested status.",
    );
  });

  it("propagates status HTTP errors without retry or mock fallback", async () => {
    for (const statusCode of [400, 403, 404, 409, 500]) {
      let calls = 0;
      const api = createLiveApi({
        apiBaseUrl: base,
        getAccessToken: () => "test-access-token",
        fetchImpl: async () => {
          calls += 1;
          return new Response(JSON.stringify({
            statusCode,
            error: "Request rejected",
            message: "Request rejected",
          }), { status: statusCode });
        },
      });

      await assert.rejects(
        () => api.setTenantStatus("11111111-1111-4111-8111-111111111111", "suspended"),
        (error: unknown) => error instanceof ApiError && error.statusCode === statusCode,
      );
      assert.equal(calls, 1);
    }
  });

  it("gets tenant subscriptions through the authenticated human client without tenant headers", async () => {
    let request: { url: string; method: string; hasBearerAuthorization: boolean; headerNames: string[] } | undefined;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        request = {
          url: String(input),
          method: init?.method ?? "",
          hasBearerAuthorization: headers.get("Authorization")?.startsWith("Bearer ") ?? false,
          headerNames: [...headers.keys()],
        };
        return new Response(JSON.stringify({
          subscription: null,
          effective: {
            tenantId: "11111111-1111-4111-8111-111111111111",
            tenantStatus: "ACTIVE",
            subscriptionId: null,
            planId: null,
            configured: false,
            operational: false,
            blockers: ["SUBSCRIPTION_MISSING"],
            quotaPolicy: null,
            quotaPolicySource: null,
            tpsLimit: null,
            tpsSource: null,
            features: [],
            channels: [
              { channel: "SMS", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
              { channel: "WHATSAPP", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
              { channel: "EMAIL", enabled: false, monthlyQuota: null, tpsLimit: null, quotaSource: "unavailable", tpsSource: "unavailable", ignoredOverride: false },
            ],
          },
        }), { status: 200 });
      },
    });

    const view = await api.getTenantSubscription("11111111-1111-4111-8111-111111111111");

    assert.deepEqual(request, {
      url: `${base}/tenants/11111111-1111-4111-8111-111111111111/subscription`,
      method: "GET",
      hasBearerAuthorization: true,
      headerNames: ["accept", "authorization"],
    });
    assert.equal(view.subscription, null);
    assert.equal(view.effective.operational, false);
  });

  it("propagates tenant subscription HTTP errors", async () => {
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => new Response(JSON.stringify({
        statusCode: 503,
        error: "Service Unavailable",
        message: "Subscription read unavailable",
      }), { status: 503 }),
    });
    await assert.rejects(
      () => api.getTenantSubscription("11111111-1111-4111-8111-111111111111"),
      (error: unknown) => error instanceof ApiError && error.statusCode === 503,
    );
  });

  it("assigns trial and active plans through the authenticated human client and maps the 201 response", async () => {
    const requests: {
      url: string;
      method: string;
      hasBearerAuthorization: boolean;
      contentType: string | null;
      headerNames: string[];
      body: unknown;
    }[] = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        const body = JSON.parse(String(init?.body)) as { status: string };
        requests.push({
          url: String(input),
          method: init?.method ?? "",
          hasBearerAuthorization: headers.get("Authorization")?.startsWith("Bearer ") ?? false,
          contentType: headers.get("Content-Type"),
          headerNames: [...headers.keys()],
          body,
        });
        return new Response(JSON.stringify(planAssignmentResponse(body.status as "TRIAL" | "ACTIVE")), { status: 201 });
      },
    });

    const activeResult = await api.assignTenantPlan(assignmentTenantId, { planId: assignmentPlanId, status: "active" });
    const trialResult = await api.assignTenantPlan(assignmentTenantId, { planId: assignmentPlanId, status: "trial" });

    assert.deepEqual(requests, ["ACTIVE", "TRIAL"].map((status) => ({
      url: `${base}/tenants/${assignmentTenantId}/subscription`,
      method: "POST",
      hasBearerAuthorization: true,
      contentType: "application/json",
      headerNames: ["accept", "authorization", "content-type"],
      body: { planId: assignmentPlanId, status },
    })));
    assert.equal(activeResult.subscription?.tenantId, assignmentTenantId);
    assert.equal(activeResult.subscription?.planId, assignmentPlanId);
    assert.equal(activeResult.subscription?.status, "active");
    assert.equal(activeResult.effective.subscriptionId, assignmentSubscriptionId);
    assert.equal(activeResult.effective.planId, assignmentPlanId);
    assert.equal(activeResult.subscription?.plan.tenants, null);
    assert.equal(trialResult.subscription?.status, "trial");
  });

  it("validates tenant, plan, and status before sending an assignment request", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify(planAssignmentResponse()), { status: 201 });
      },
    });

    await assert.rejects(() => api.assignTenantPlan("not-a-uuid", {
      planId: assignmentPlanId,
      status: "active",
    }));
    await assert.rejects(() => api.assignTenantPlan(assignmentTenantId, {
      planId: "not-a-uuid",
      status: "active",
    }));
    const invalidStatusApi = api as unknown as {
      assignTenantPlan(tenantId: string, input: { planId: string; status: string }): Promise<unknown>;
    };
    await assert.rejects(() => invalidStatusApi.assignTenantPlan(assignmentTenantId, {
      planId: assignmentPlanId,
      status: "pending",
    }));
    assert.equal(calls, 0);
  });

  it("rejects assignment responses with a different tenant, plan, or status", async () => {
    for (const response of [
      planAssignmentResponse("ACTIVE", {
        tenantId: "44444444-4444-4444-8444-444444444444",
      }),
      planAssignmentResponse("ACTIVE", {
        planId: "44444444-4444-4444-8444-444444444444",
        effectivePlanId: "44444444-4444-4444-8444-444444444444",
      }),
      planAssignmentResponse("TRIAL"),
    ]) {
      const api = createLiveApi({
        apiBaseUrl: base,
        getAccessToken: () => "test-access-token",
        fetchImpl: async () => new Response(JSON.stringify(response), { status: 201 }),
      });
      await assert.rejects(() => api.assignTenantPlan(assignmentTenantId, {
        planId: assignmentPlanId,
        status: "active",
      }));
    }

    const malformedApi = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => new Response(JSON.stringify({ subscription: null }), { status: 201 }),
    });
    await assert.rejects(() => malformedApi.assignTenantPlan(assignmentTenantId, {
      planId: assignmentPlanId,
      status: "active",
    }));
  });

  it("propagates assignment HTTP errors once without retries or mock fallback", async () => {
    for (const statusCode of [400, 403, 404, 409, 422, 503]) {
      let calls = 0;
      const api = createLiveApi({
        apiBaseUrl: base,
        getAccessToken: () => "test-access-token",
        fetchImpl: async () => {
          calls += 1;
          return new Response(JSON.stringify({
            statusCode,
            error: "Request rejected",
            message: "Request rejected",
          }), { status: statusCode });
        },
      });

      await assert.rejects(
        () => api.assignTenantPlan(assignmentTenantId, {
          planId: assignmentPlanId,
          status: "trial",
        }),
        (error: unknown) => error instanceof ApiError && error.statusCode === statusCode,
      );
      assert.equal(calls, 1);
    }
  });

  it("uses the subscription history, override, channel, clear, and immediate-cancel contracts", async () => {
    const requests: {
      url: string;
      method: string;
      body: unknown;
      hasContentType: boolean;
    }[] = [];
    const assignment = planAssignmentResponse();
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        requests.push({
          url: String(input),
          method: init?.method ?? "",
          body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
          hasContentType: headers.has("Content-Type"),
        });
        if (String(input).includes("/history?")) {
          return new Response(
            JSON.stringify({
              items: [{ ...assignment.subscription, status: "CANCELLED" }],
              page: 1,
              pageSize: 20,
              total: 1,
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify(assignment), { status: 200 });
      },
    });

    const history = await api.getTenantSubscriptionHistory(assignmentTenantId, {
      page: 1,
      pageSize: 20,
    });
    const updated = await api.updateTenantSubscriptionOverrides(assignmentTenantId, {
      tpsLimitOverride: null,
      quotaPolicyOverride: "soft_cap",
    });
    await api.setTenantSubscriptionChannelOverride(assignmentTenantId, "sms", {
      enabledOverride: false,
      monthlyQuotaOverride: 0,
      tpsOverride: null,
    });
    await api.clearTenantSubscriptionChannelOverride(assignmentTenantId, "whatsapp");
    await api.cancelTenantSubscription(assignmentTenantId);

    assert.equal(history.items[0]?.status, "cancelled");
    assert.equal(history.total, 1);
    assert.equal(updated.subscription?.id, assignmentSubscriptionId);
    assert.deepEqual(requests, [
      {
        url: `${base}/tenants/${assignmentTenantId}/subscription/history?page=1&pageSize=20`,
        method: "GET",
        body: undefined,
        hasContentType: false,
      },
      {
        url: `${base}/tenants/${assignmentTenantId}/subscription/overrides`,
        method: "PUT",
        body: { tpsLimitOverride: null, quotaPolicyOverride: "SOFT_CAP" },
        hasContentType: true,
      },
      {
        url: `${base}/tenants/${assignmentTenantId}/subscription/channels/SMS`,
        method: "PUT",
        body: { enabledOverride: false, monthlyQuotaOverride: 0, tpsOverride: null },
        hasContentType: true,
      },
      {
        url: `${base}/tenants/${assignmentTenantId}/subscription/channels/WHATSAPP`,
        method: "DELETE",
        body: undefined,
        hasContentType: false,
      },
      {
        url: `${base}/tenants/${assignmentTenantId}/subscription/cancel`,
        method: "POST",
        body: {},
        hasContentType: true,
      },
    ]);
    assert.equal("endsAt" in (requests[4]?.body as Record<string, unknown>), false);
  });

  it("rejects invalid subscription override bodies before making a live request", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => "test-access-token",
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify(planAssignmentResponse()), { status: 200 });
      },
    });

    await assert.rejects(() => api.updateTenantSubscriptionOverrides(assignmentTenantId, {}));
    await assert.rejects(() =>
      api.updateTenantSubscriptionOverrides(assignmentTenantId, {
        tpsLimitOverride: 0,
      }),
    );
    await assert.rejects(() =>
      api.setTenantSubscriptionChannelOverride(assignmentTenantId, "email", {
        monthlyQuotaOverride: -1,
      }),
    );
    await assert.rejects(() => api.cancelTenantSubscription("invalid-tenant-id"));
    assert.equal(calls, 0);
  });
});
