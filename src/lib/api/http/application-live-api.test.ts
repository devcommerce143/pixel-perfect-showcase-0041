import assert from "node:assert/strict";
import test from "node:test";
import type { SenderIdentityActor } from "../types.ts";
import {
  applicationDetailPath,
  applicationListPath,
  ApplicationRequestError,
  mapApplication,
  mapApplicationPage,
  mapPlatformApplicationPage,
  platformApplicationListPath,
} from "./application-mapper.ts";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  applicationReadQueryOptions,
  applicationDetailQueryKey,
  applicationPageQueryKey,
} from "../application-query-keys.ts";
import { applicationMutationControlsEnabled } from "../application-ui-policy.ts";
import {
  applicationDetailTenantId,
  applicationScopeKey,
  applicationSelectionMatchesScope,
} from "../application-ui-policy.ts";
import { allTenantApplicationPageQueryKey } from "../application-query-keys.ts";

const tenantId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";

const tenantActor: SenderIdentityActor = {
  role: "client_admin",
  tenantId,
  userId: "tenant-user",
  name: "Tenant admin",
};

const platformActor: SenderIdentityActor = {
  role: "super_admin",
  tenantId: null,
  userId: "platform-user",
  name: "Platform admin",
};

const applicationDto = {
  id: applicationId,
  tenantId,
  name: "Billing API",
  environment: "PRODUCTION",
  status: "ACTIVE",
  channels: ["SMS", "WHATSAPP"],
  scopes: ["MESSAGES_SEND", "WEBHOOKS_MANAGE"],
  senderAccess: "ALLOW_LIST",
  allowListSenderIds: ["33333333-3333-4333-8333-333333333333"],
  channelAvailability: [
    { channel: "SMS", granted: true, available: true },
    { channel: "WHATSAPP", granted: true, available: false },
  ],
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-03T03:04:05.000Z",
};
const platformApplicationDto = { ...applicationDto, tenantName: "Tenant One" };

test("builds tenant and platform application read paths with supported pagination only", () => {
  assert.equal(
    applicationListPath("client_admin", 2, 20, "ignored"),
    "/applications?page=2&pageSize=20",
  );
  assert.equal(
    applicationListPath("super_admin", 2, 20, tenantId),
    `/tenants/${tenantId}/applications?page=2&pageSize=20`,
  );
  assert.equal(
    applicationDetailPath("client_admin", applicationId, "ignored"),
    `/applications/${applicationId}`,
  );
  assert.equal(
    applicationDetailPath("super_admin", applicationId, tenantId),
    `/tenants/${tenantId}/applications/${applicationId}`,
  );
  assert.throws(
    () => applicationListPath("super_admin", 1, 20),
    ApplicationRequestError,
  );
  assert.throws(
    () => applicationListPath("client_admin", 1, 101),
    ApplicationRequestError,
  );
});

test("maps the backend application DTO and page envelope explicitly", () => {
  const page = mapApplicationPage({
    items: [applicationDto],
    page: 1,
    pageSize: 20,
    total: 1,
  });
  assert.deepEqual(page, {
    items: [{
      id: applicationId,
      tenantId,
      name: "Billing API",
      environment: "production",
      status: "active",
      channels: ["sms", "whatsapp"],
      scopes: ["messages:send", "webhooks:manage"],
      senderAccess: "allow_list",
      allowListSenderIds: ["33333333-3333-4333-8333-333333333333"],
      channelAvailability: [
        { channel: "sms", granted: true, available: true },
        { channel: "whatsapp", granted: true, available: false },
      ],
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-03T03:04:05.000Z",
    }],
    page: 1,
    pageSize: 20,
    total: 1,
  });
  assert.throws(
    () => mapApplication({ ...applicationDto, status: "ENABLED" }),
    /status is invalid/,
  );
  assert.equal(mapApplication(applicationDto).credentialCount, undefined);
});

test("maps platform application pages and requires tenant identity", () => {
  const page = mapPlatformApplicationPage({
    items: [platformApplicationDto],
    page: 2,
    pageSize: 20,
    total: 21,
  });
  assert.equal(page.items[0]?.tenantId, tenantId);
  assert.equal(page.items[0]?.tenantName, "Tenant One");
  assert.equal(page.page, 2);
  assert.throws(
    () => mapPlatformApplicationPage({
      items: [applicationDto],
      page: 1,
      pageSize: 20,
      total: 1,
    }),
    /tenantName is invalid/,
  );
  assert.equal(platformApplicationListPath(2, 20), "/platform/applications?page=2&pageSize=20");
  assert.throws(() => platformApplicationListPath(1, 101), ApplicationRequestError);
});

test("isolates application list and detail cache keys by tenant and application", () => {
  const query = { page: 1, pageSize: 20 };
  assert.notDeepEqual(
    applicationPageQueryKey(platformActor, query, tenantId),
    applicationPageQueryKey(platformActor, query, "44444444-4444-4444-8444-444444444444"),
  );
  assert.notDeepEqual(
    applicationDetailQueryKey(platformActor, applicationId, tenantId),
    applicationDetailQueryKey(platformActor, applicationId, "44444444-4444-4444-8444-444444444444"),
  );
  assert.notDeepEqual(
    applicationDetailQueryKey(tenantActor, applicationId),
    applicationDetailQueryKey(tenantActor, "55555555-5555-4555-8555-555555555555"),
  );
});

test("separates All Tenants cache and scopes details to the selected row", () => {
  const query = { page: 1, pageSize: 20 };
  assert.notDeepEqual(
    allTenantApplicationPageQueryKey(platformActor, query),
    applicationPageQueryKey(platformActor, query, tenantId),
  );
  assert.equal(applicationDetailTenantId(true, undefined, tenantId), tenantId);
  assert.equal(applicationDetailTenantId(true, "44444444-4444-4444-8444-444444444444", tenantId), "44444444-4444-4444-8444-444444444444");

  const tenantAScope = applicationScopeKey(platformActor, tenantId);
  const tenantBScope = applicationScopeKey(platformActor, "44444444-4444-4444-8444-444444444444");
  const allScope = applicationScopeKey(platformActor);
  assert.equal(applicationSelectionMatchesScope(tenantId, tenantAScope, tenantBScope, true), false);
  assert.equal(applicationSelectionMatchesScope(tenantId, tenantAScope, allScope, true), false);
  assert.equal(applicationSelectionMatchesScope(tenantId, allScope, allScope, true), true);
});

test("does not retain prior-scope data for application reads and disables All Tenants queries", () => {
  const options = applicationReadQueryOptions(
    applicationPageQueryKey(platformActor, { page: 1, pageSize: 20 }),
    async () => [],
    false,
  );
  assert.equal(options.enabled, false);
  assert.equal("placeholderData" in options, false);
});

test("hides application mutation controls in live mode but preserves mock controls", () => {
  assert.equal(applicationMutationControlsEnabled("live"), false);
  assert.equal(applicationMutationControlsEnabled("mock"), true);
});

test("uses authenticated tenant routes and maps live list and detail responses", async () => {
  const requests: string[] = [];
  const liveApi = createLiveApi({
    apiBaseUrl: "https://api.example.test/api/v1",
    getAccessToken: () => "test-token",
    fetchImpl: async (input) => {
      requests.push(String(input));
      const body = requests.length === 1
        ? { items: [applicationDto], page: 2, pageSize: 20, total: 21 }
        : applicationDto;
      return new Response(JSON.stringify(body), { status: 200 });
    },
  });

  const page = await liveApi.listApplicationsPage(
    tenantActor,
    {
      page: 2,
      pageSize: 20,
      search: "ignored",
      filters: { status: "active", tenantId: "ignored" },
      sortBy: "status",
      sortDirection: "desc",
    },
    "ignored",
  );
  const detail = await liveApi.getApplication(tenantActor, applicationId, "ignored");

  assert.equal(page.total, 21);
  assert.equal(detail?.id, applicationId);
  assert.equal(requests[0], "https://api.example.test/api/v1/applications?page=2&pageSize=20");
  assert.equal(requests[1], `https://api.example.test/api/v1/applications/${applicationId}`);
});

test("uses named-tenant platform routes and refuses All Tenants requests", async () => {
  const requests: string[] = [];
  const liveApi = createLiveApi({
    apiBaseUrl: "https://api.example.test/api/v1",
    getAccessToken: () => "test-token",
    fetchImpl: async (input) => {
      requests.push(String(input));
      return new Response(JSON.stringify({ items: [applicationDto], page: 1, pageSize: 20, total: 1 }), { status: 200 });
    },
  });

  await liveApi.listApplicationsPage(platformActor, { page: 1, pageSize: 20 }, tenantId);
  await assert.rejects(
    () => liveApi.listApplicationsPage(platformActor, { page: 1, pageSize: 20 }),
    ApplicationRequestError,
  );
  assert.deepEqual(requests, [
    `https://api.example.test/api/v1/tenants/${tenantId}/applications?page=1&pageSize=20`,
  ]);
});

test("uses the platform-wide applications endpoint with pagination", async () => {
  const requests: string[] = [];
  const liveApi = createLiveApi({
    apiBaseUrl: "https://api.example.test/api/v1",
    getAccessToken: () => "test-token",
    fetchImpl: async (input) => {
      requests.push(String(input));
      const response = requests.length === 1
        ? { items: [platformApplicationDto], page: 2, pageSize: 20, total: 21 }
        : applicationDto;
      return new Response(JSON.stringify(response), { status: 200 });
    },
  });
  const result = await liveApi.listAllTenantApplications(platformActor, {
    page: 2,
    pageSize: 20,
    search: "not sent",
    filters: { status: "active", tenantId },
  });
  const rowTenantId = result.items[0]?.tenantId;
  assert.ok(rowTenantId);
  const detail = await liveApi.getApplication(
    platformActor,
    applicationId,
    applicationDetailTenantId(true, undefined, rowTenantId),
  );

  assert.equal(requests[0], "https://api.example.test/api/v1/platform/applications?page=2&pageSize=20");
  assert.equal(requests[1], `https://api.example.test/api/v1/tenants/${tenantId}/applications/${applicationId}`);
  assert.equal(result.items[0]?.tenantId, tenantId);
  assert.equal(result.items[0]?.tenantName, "Tenant One");
  assert.equal(result.page, 2);
  assert.equal(detail?.id, applicationId);
});

test("propagates live API failures without a mock fallback", async () => {
  const liveApi = createLiveApi({
    apiBaseUrl: "https://api.example.test/api/v1",
    getAccessToken: () => "test-token",
    fetchImpl: async () =>
      new Response(JSON.stringify({ statusCode: 503, message: "Sensitive internal detail" }), { status: 503 }),
  });
  await assert.rejects(
    () => liveApi.listApplicationsPage(tenantActor, { page: 1, pageSize: 20 }),
    (error: unknown) => error instanceof ApiError && error.statusCode === 503,
  );
});
