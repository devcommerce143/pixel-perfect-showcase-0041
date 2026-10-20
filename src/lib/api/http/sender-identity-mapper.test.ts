import assert from "node:assert/strict";
import test from "node:test";
import type { SenderIdentityActor } from "../types.ts";
import {
  mapSenderIdentity,
  mapSenderIdentityPage,
  mapPlatformSenderIdentityPage,
  platformSenderIdentityListPath,
  SenderIdentityRequestError,
  senderIdentityDetailPath,
  senderIdentityListPath,
} from "./sender-identity-mapper.ts";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  allTenantSenderIdentityPageQueryKey,
  senderIdentityDetailQueryKey,
  senderIdentityDetailTenantId,
  senderIdentityPageQueryKey,
  senderIdentityScopeKey,
  senderIdentityScopeIsAvailable,
  senderIdentitySelectionMatchesScope,
  senderIdentityUsesReadOnlyView,
} from "../sender-identity-query-keys.ts";

const tenantId = "11111111-1111-4111-8111-111111111111";
const senderId = "22222222-2222-4222-8222-222222222222";
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
const senderDto = {
  id: senderId,
  tenantId,
  channel: "SMS",
  displayName: null,
  verificationStatus: "PENDING_VERIFICATION",
  operationalStatus: "INACTIVE",
  providerReference: null,
  rejectionReason: null,
  suspensionReason: null,
  sms: { senderId: "DOLF", countryCode: "SA" },
  email: null,
  whatsapp: null,
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-03T03:04:05.000Z",
};

test("builds tenant and selected-tenant paths with supported filters and pagination", () => {
  assert.equal(
    senderIdentityListPath(
      "client_admin",
      2,
      20,
      {
        channel: "whatsapp",
        verificationStatus: "pending_verification",
        operationalStatus: "active",
      },
      tenantId,
    ),
    "/senders?page=2&pageSize=20&channel=WHATSAPP&verificationStatus=PENDING_VERIFICATION&operationalStatus=ACTIVE",
  );
  assert.equal(
    senderIdentityListPath("super_admin", 1, 50, {}, tenantId),
    `/tenants/${tenantId}/senders?page=1&pageSize=50`,
  );
  assert.equal(
    senderIdentityDetailPath("client_admin", senderId, "ignored"),
    `/senders/${senderId}`,
  );
  assert.equal(
    senderIdentityDetailPath("super_admin", senderId, tenantId),
    `/tenants/${tenantId}/senders/${senderId}`,
  );
  assert.throws(() => senderIdentityListPath("super_admin", 1, 20), SenderIdentityRequestError);
  assert.throws(() => senderIdentityListPath("client_admin", 1, 101), SenderIdentityRequestError);
  assert.throws(
    () => senderIdentityDetailPath("client_admin", "invalid-id"),
    SenderIdentityRequestError,
  );
});

test("maps list envelope, nullable common fields, and SMS profile", () => {
  const result = mapSenderIdentityPage({
    items: [senderDto],
    page: 1,
    pageSize: 20,
    total: 1,
  });
  assert.deepEqual(result, {
    items: [
      {
        id: senderId,
        tenantId,
        channel: "sms",
        displayName: null,
        verificationStatus: "pending_verification",
        operationalStatus: "inactive",
        providerReference: null,
        rejectionReason: null,
        suspensionReason: null,
        sms: { senderId: "DOLF", countryCode: "SA" },
        createdAt: "2026-01-02T03:04:05.000Z",
        updatedAt: "2026-01-03T03:04:05.000Z",
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
  });
});

test("maps platform sender pages with tenant metadata", () => {
  const page = mapPlatformSenderIdentityPage({
    items: [{ ...senderDto, tenantName: "Tenant One" }],
    page: 1,
    pageSize: 20,
    total: 1,
  });
  assert.equal(page.items[0]?.tenantId, tenantId);
  assert.equal(page.items[0]?.tenantName, "Tenant One");
  assert.equal(
    platformSenderIdentityListPath(2, 50, {
      tenantId,
      channel: "sms",
      verificationStatus: "verified",
      operationalStatus: "active",
    }),
    `/platform/senders?page=2&pageSize=50&channel=SMS&verificationStatus=VERIFIED&operationalStatus=ACTIVE&tenantId=${tenantId}`,
  );
  assert.throws(
    () =>
      platformSenderIdentityListPath(1, 20, {
        tenantId: "not-a-tenant-id",
      }),
    /tenant ID is invalid/,
  );
  assert.throws(
    () =>
      mapPlatformSenderIdentityPage({
        items: [senderDto],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    /tenantName is invalid/,
  );
});

test("maps email and WhatsApp channel-specific profiles and status enums", () => {
  const email = mapSenderIdentity({
    ...senderDto,
    channel: "EMAIL",
    email: {
      emailAddress: "alerts@example.test",
      domain: "example.test",
      domainVerificationStatus: "NOT_CONFIGURED",
      spfStatus: "PENDING",
      dkimStatus: "VERIFIED",
    },
  });
  assert.equal(email.channel, "email");
  if (email.channel === "email") {
    assert.deepEqual(email.email, {
      emailAddress: "alerts@example.test",
      domain: "example.test",
      domainVerificationStatus: "not_configured",
      spfStatus: "pending",
      dkimStatus: "verified",
    });
  }

  const whatsapp = mapSenderIdentity({
    ...senderDto,
    channel: "WHATSAPP",
    verificationStatus: "VERIFIED",
    operationalStatus: "ACTIVE",
    whatsapp: {
      businessDisplayName: "Dolf",
      phoneNumber: "+966500000000",
      countryCode: "+966",
      wabaId: "waba-ref",
      phoneNumberId: "phone-ref",
    },
  });
  assert.equal(whatsapp.channel, "whatsapp");
  if (whatsapp.channel === "whatsapp") {
    assert.deepEqual(whatsapp.whatsapp, {
      businessDisplayName: "Dolf",
      phoneNumber: "+966500000000",
      countryCode: "+966",
      wabaId: "waba-ref",
      phoneNumberId: "phone-ref",
    });
    assert.equal(whatsapp.verificationStatus, "verified");
    assert.equal(whatsapp.operationalStatus, "active");
  }
  assert.throws(
    () => mapSenderIdentity({ ...senderDto, verificationStatus: "APPROVED" }),
    /verificationStatus is invalid/,
  );
  assert.throws(
    () => mapSenderIdentity({ ...senderDto, sms: null }),
    /SMS sender profile is missing/,
  );
  assert.throws(
    () =>
      mapSenderIdentityPage({
        items: [senderDto],
        page: 1,
        pageSize: 101,
        total: 1,
      }),
    /pageSize is invalid/,
  );
});

test("isolates sender list/detail cache and selection scopes", () => {
  const query = { page: 1, pageSize: 20, filters: { channel: "all" as const } };
  assert.notDeepEqual(
    senderIdentityPageQueryKey(platformActor, query, tenantId),
    senderIdentityPageQueryKey(platformActor, query, "33333333-3333-4333-8333-333333333333"),
  );
  assert.notDeepEqual(
    allTenantSenderIdentityPageQueryKey(platformActor, query),
    senderIdentityPageQueryKey(platformActor, query, tenantId),
  );
  assert.notDeepEqual(
    allTenantSenderIdentityPageQueryKey(platformActor, query),
    allTenantSenderIdentityPageQueryKey(platformActor, {
      ...query,
      filters: { ...query.filters, tenantId },
    }),
  );
  assert.notDeepEqual(
    senderIdentityPageQueryKey(tenantActor, query),
    senderIdentityPageQueryKey(platformActor, query, tenantId),
  );
  assert.notDeepEqual(
    senderIdentityPageQueryKey(platformActor, query, tenantId),
    senderIdentityPageQueryKey(
      { ...platformActor, userId: "another-platform-user" },
      query,
      tenantId,
    ),
  );
  assert.notDeepEqual(
    senderIdentityPageQueryKey(platformActor, query, tenantId),
    senderIdentityPageQueryKey(platformActor, { ...query, page: 2 }, tenantId),
  );
  assert.notDeepEqual(
    senderIdentityDetailQueryKey(platformActor, senderId, tenantId),
    senderIdentityDetailQueryKey(platformActor, senderId, "33333333-3333-4333-8333-333333333333"),
  );
  assert.notDeepEqual(
    senderIdentityDetailQueryKey(platformActor, senderId, tenantId),
    senderIdentityDetailQueryKey(platformActor, "44444444-4444-4444-8444-444444444444", tenantId),
  );

  const scopeA = senderIdentityScopeKey(platformActor, tenantId);
  const scopeB = senderIdentityScopeKey(platformActor, "33333333-3333-4333-8333-333333333333");
  assert.equal(senderIdentitySelectionMatchesScope(scopeA, scopeB), false);
  assert.equal(senderIdentitySelectionMatchesScope(scopeA, scopeA), true);
  assert.equal(senderIdentityDetailTenantId(true, tenantId, tenantId), tenantId);
  assert.equal(senderIdentityDetailTenantId(true, undefined, tenantId, true), tenantId);
  assert.equal(
    senderIdentityDetailTenantId(true, tenantId, "33333333-3333-4333-8333-333333333333"),
    undefined,
  );
  assert.equal(senderIdentityDetailTenantId(false, tenantId, tenantId), undefined);
  assert.equal(senderIdentityUsesReadOnlyView("live"), true);
  assert.equal(senderIdentityUsesReadOnlyView("mock"), false);
  assert.equal(senderIdentityScopeIsAvailable("super_admin"), false);
  assert.equal(senderIdentityScopeIsAvailable("super_admin", tenantId), true);
  assert.equal(senderIdentityScopeIsAvailable("super_admin", "not-a-tenant-id"), false);
  assert.equal(senderIdentityScopeIsAvailable("client_admin"), true);
});

test("uses authenticated live endpoints and propagates failures without mock fallback", async () => {
  const requests: string[] = [];
  const liveApi = createLiveApi({
    apiBaseUrl: "https://api.example.test/api/v1",
    getAccessToken: () => "test-token",
    fetchImpl: async (input) => {
      requests.push(String(input));
      const body =
        requests.length === 3
          ? senderDto
          : {
              items: [senderDto],
              page: requests.length === 2 ? 2 : 1,
              pageSize: requests.length === 2 ? 50 : 20,
              total: 1,
            };
      return new Response(JSON.stringify(body), { status: 200 });
    },
  });

  test("uses the platform-wide sender endpoint without a duplicate tenant filter", async () => {
    const requests: string[] = [];
    const liveApi = createLiveApi({
      apiBaseUrl: "https://api.example.test/api/v1",
      getAccessToken: () => "test-token",
      fetchImpl: async (input) => {
        requests.push(String(input));
        return new Response(
          JSON.stringify({
            items: [{ ...senderDto, tenantName: "Tenant One" }],
            page: 2,
            pageSize: 50,
            total: 51,
          }),
          { status: 200 },
        );
      },
    });

    const page = await liveApi.listAllTenantSenderIdentityReadPage(platformActor, {
      page: 2,
      pageSize: 50,
      search: "ignored",
      sortBy: "updatedAt",
      filters: {
        channel: "email",
        verificationStatus: "verified",
        operationalStatus: "active",
      },
    });
    assert.equal(page.items[0]?.tenantName, "Tenant One");
    assert.equal(page.items[0]?.tenantId, tenantId);
    assert.equal(page.page, 2);
    assert.equal(page.pageSize, 50);
    assert.deepEqual(requests, [
      "https://api.example.test/api/v1/platform/senders?page=2&pageSize=50&channel=EMAIL&verificationStatus=VERIFIED&operationalStatus=ACTIVE",
    ]);

    await assert.rejects(
      () =>
        liveApi.listAllTenantSenderIdentityReadPage(tenantActor, {
          page: 1,
          pageSize: 20,
        }),
      /platform administrator/,
    );
    assert.equal(requests.length, 1);
  });

  const page = await liveApi.listSenderIdentityReadPage(tenantActor, {
    page: 1,
    pageSize: 20,
    search: "not sent",
    sortBy: "updatedAt",
  });
  const platformPage = await liveApi.listSenderIdentityReadPage(
    platformActor,
    {
      page: 2,
      pageSize: 50,
      filters: { channel: "email", operationalStatus: "active" },
    },
    tenantId,
  );
  const detail = await liveApi.getSenderIdentityRead(platformActor, senderId, tenantId);
  assert.equal(page.items[0]?.id, senderId);
  assert.equal(platformPage.pageSize, 50);
  assert.equal(detail?.id, senderId);
  assert.deepEqual(requests, [
    "https://api.example.test/api/v1/senders?page=1&pageSize=20",
    `https://api.example.test/api/v1/tenants/${tenantId}/senders?page=2&pageSize=50&channel=EMAIL&operationalStatus=ACTIVE`,
    `https://api.example.test/api/v1/tenants/${tenantId}/senders/${senderId}`,
  ]);

  const failingApi = createLiveApi({
    apiBaseUrl: "https://api.example.test/api/v1",
    getAccessToken: () => "test-token",
    fetchImpl: async () =>
      new Response(JSON.stringify({ statusCode: 503, message: "Unavailable" }), {
        status: 503,
      }),
  });
  await assert.rejects(
    () =>
      failingApi.listSenderIdentityReadPage(tenantActor, {
        page: 1,
        pageSize: 20,
      }),
    (error: unknown) => error instanceof ApiError && error.statusCode === 503,
  );
});
