import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./errors.ts";
import { createLiveApi } from "./live-api.ts";
import {
  allTenantMessageHistoryQueryKey,
  messageHistoryDetailTenantId,
  messageHistoryScope,
  tenantMessageHistoryQueryKey,
} from "../message-history-query-keys.ts";
import {
  buildMessageHistoryQuery,
  defaultMessageHistoryDateRange,
  mapMessageHistoryDetail,
  mapMessageHistoryPage,
  mapPlatformMessageHistoryPage,
  messageHistoryPageCsv,
  messageHistoryListPath,
  platformMessageHistoryListPath,
} from "./message-history-mapper.ts";

const base = "https://engine.example/api/v1";
const token = "test-history-token";
const tenantId = "11111111-1111-4111-8111-111111111111";
const applicationId = "22222222-2222-4222-8222-222222222222";
const messageId = "33333333-3333-4333-8333-333333333333";
const senderId = "44444444-4444-4444-8444-444444444444";
const acceptedAt = "2026-10-20T00:00:00.000Z";
const tenantActor = {
  role: "client_admin",
  tenantId,
  userId: senderId,
  name: "Tenant admin",
} as const;
const platformActor = {
  role: "super_admin",
  tenantId: null,
  userId: senderId,
  name: "Platform admin",
} as const;

function detailResponse() {
  return {
    id: messageId,
    applicationId,
    channel: "SMS",
    status: "QUEUED",
    acceptedAt,
    queuedAt: acceptedAt,
    senderIdentityId: senderId,
    templateId: null,
    correlationId: "correlation-1",
    contentPurgedAt: null,
    recipientNormalized: "+966500000000",
    attempts: [
      {
        attemptNumber: 1,
        state: "SUBMITTING",
        errorCategory: "PROVIDER_UNAVAILABLE",
        startedAt: acceptedAt,
        finishedAt: null,
      },
    ],
  };
}

const query = buildMessageHistoryQuery(
  { from: "2026-10-01", through: "2026-10-20" },
  { page: 1, pageSize: 20, channel: "sms", status: "accepted" },
);

describe("message history mapping", () => {
  it("maps the list envelope and excludes fields omitted by the backend", () => {
    assert.deepEqual(
      mapMessageHistoryPage({
        items: [
          {
            id: messageId,
            applicationId,
            channel: "WHATSAPP",
            status: "ACCEPTED",
            acceptedAt,
            queuedAt: null,
            recipient: "+966500000000",
            templateName: "not-in-contract",
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
      {
        items: [
          {
            id: messageId,
            applicationId,
            channel: "whatsapp",
            status: "accepted",
            acceptedAt,
            queuedAt: null,
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      },
    );
  });

  it("maps the detail DTO without fabricating content or delivery events", () => {
    const detail = mapMessageHistoryDetail(detailResponse());
    assert.deepEqual(detail, {
      id: messageId,
      applicationId,
      channel: "sms",
      status: "queued",
      acceptedAt,
      queuedAt: acceptedAt,
      senderIdentityId: senderId,
      templateId: null,
      correlationId: "correlation-1",
      contentPurgedAt: null,
      recipientNormalized: "+966500000000",
      attempts: [
        {
          attemptNumber: 1,
          state: "submitting",
          errorCategory: "PROVIDER_UNAVAILABLE",
          startedAt: acceptedAt,
          finishedAt: null,
        },
      ],
    });
    assert.equal("body" in detail, false);
    assert.equal("events" in detail, false);
    assert.equal("deliveryAt" in detail, false);
    assert.equal("providerName" in detail.attempts[0]!, false);
  });

  it("builds deterministic UTC boundaries and accepts at most 31 days", () => {
    assert.deepEqual(defaultMessageHistoryDateRange(new Date("2026-10-20T23:59:59.999Z")), {
      from: "2026-09-20",
      through: "2026-10-20",
    });
    assert.deepEqual(
      buildMessageHistoryQuery(
        { from: "2026-09-20", through: "2026-10-20" },
        { page: 2, pageSize: 20, channel: "email", status: "submitted" },
      ),
      {
        acceptedFrom: "2026-09-20T00:00:00.000Z",
        acceptedTo: "2026-10-21T00:00:00.000Z",
        page: 2,
        pageSize: 20,
        channel: "email",
        status: "submitted",
      },
    );
    assert.throws(
      () =>
        buildMessageHistoryQuery(
          { from: "2026-09-19", through: "2026-10-20" },
          { page: 1, pageSize: 20 },
        ),
      RangeError,
    );
    assert.throws(
      () =>
        buildMessageHistoryQuery(
          { from: "2026-02-30", through: "2026-03-01" },
          { page: 1, pageSize: 20 },
        ),
      RangeError,
    );
  });

  it("keeps all-tenant, tenant, filter, and page cache keys isolated", () => {
    const allKey = allTenantMessageHistoryQueryKey(query, platformActor);
    const tenantKey = tenantMessageHistoryQueryKey(query, platformActor, tenantId);
    const changedFilterKey = tenantMessageHistoryQueryKey(
      { ...query, status: "failed" },
      platformActor,
      tenantId,
    );
    const changedPageKey = tenantMessageHistoryQueryKey(
      { ...query, page: 2 },
      platformActor,
      tenantId,
    );
    assert.notDeepEqual(allKey, tenantKey);
    assert.notDeepEqual(
      tenantKey,
      tenantMessageHistoryQueryKey(query, platformActor, "55555555-5555-4555-8555-555555555555"),
    );
    assert.notDeepEqual(tenantKey, changedFilterKey);
    assert.notDeepEqual(tenantKey, changedPageKey);
  });

  it("selects All Tenants on initial load and switches back after a tenant selection", () => {
    assert.equal(messageHistoryScope(true), "all-tenants");
    assert.equal(messageHistoryScope(true, tenantId), "tenant");
    assert.equal(messageHistoryScope(true), "all-tenants");
    assert.equal(messageHistoryScope(false), "tenant");
    assert.equal(
      messageHistoryDetailTenantId({
        id: messageId,
        applicationId,
        channel: "sms",
        status: "accepted",
        acceptedAt,
        queuedAt: null,
        tenantId,
        tenantName: "Tenant One",
      }),
      tenantId,
    );
    assert.equal(
      messageHistoryDetailTenantId({
        id: messageId,
        applicationId,
        channel: "sms",
        status: "accepted",
        acceptedAt,
        queuedAt: null,
      }),
      undefined,
    );
  });

  it("serializes only backend filters and enforces page bounds", () => {
    assert.equal(
      messageHistoryListPath(query),
      "/message-history?acceptedFrom=2026-10-01T00%3A00%3A00.000Z&acceptedTo=2026-10-21T00%3A00%3A00.000Z&page=1&pageSize=20&channel=SMS&status=ACCEPTED",
    );
    assert.throws(() => messageHistoryListPath({ ...query, pageSize: 101 }), RangeError);
    assert.equal(
      platformMessageHistoryListPath(query),
      `/platform/message-history?${messageHistoryListPath(query).split("?")[1]}`,
    );
  });

  it("maps platform tenant identity without widening the tenant history shape", () => {
    const response = {
      items: [
        {
          id: messageId,
          applicationId,
          channel: "SMS",
          status: "ACCEPTED",
          acceptedAt,
          queuedAt: null,
          tenantId,
          tenantName: "Tenant One",
          recipientNormalized: "+966500000000",
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    };
    assert.deepEqual(mapPlatformMessageHistoryPage(response).items[0], {
      id: messageId,
      applicationId,
      channel: "sms",
      status: "accepted",
      acceptedAt,
      queuedAt: null,
      tenantId,
      tenantName: "Tenant One",
    });
    assert.throws(
      () =>
        mapPlatformMessageHistoryPage({
          ...response,
          items: [{ ...response.items[0], tenantId: "not-a-uuid" }],
        }),
      /tenantId/,
    );
  });

  it("exports exactly the loaded page using only contract fields", () => {
    assert.equal(
      messageHistoryPageCsv([
        {
          id: messageId,
          applicationId,
          channel: "sms",
          status: "accepted",
          acceptedAt,
          queuedAt: null,
        },
      ]),
      [
        '"id","applicationId","channel","status","acceptedAt","queuedAt"',
        `"${messageId}","${applicationId}","sms","accepted","${acceptedAt}",""`,
      ].join("\r\n"),
    );
    assert.equal(
      messageHistoryPageCsv([
        {
          id: messageId,
          applicationId,
          tenantId,
          tenantName: "Tenant One",
          channel: "sms",
          status: "accepted",
          acceptedAt,
          queuedAt: null,
        },
      ]),
      [
        '"id","applicationId","tenantName","tenantId","channel","status","acceptedAt","queuedAt"',
        `"${messageId}","${applicationId}","Tenant One","${tenantId}","sms","accepted","${acceptedAt}",""`,
      ].join("\r\n"),
    );
  });

  it("maps empty results and rejects malformed responses", () => {
    assert.deepEqual(mapMessageHistoryPage({ items: [], page: 1, pageSize: 20, total: 0 }), {
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    assert.throws(
      () => mapMessageHistoryPage({ items: {}, page: 1, pageSize: 20, total: 0 }),
      /array/,
    );
    assert.throws(
      () => mapMessageHistoryPage({ items: [], page: 0, pageSize: 20, total: 0 }),
      /page/,
    );
    assert.throws(
      () => mapMessageHistoryDetail({ ...detailResponse(), status: "CANCELLED" }),
      /status/,
    );
    assert.throws(
      () => mapMessageHistoryDetail({ ...detailResponse(), attempts: "invalid" }),
      /attempts/,
    );
    assert.throws(
      () =>
        mapMessageHistoryDetail({
          ...detailResponse(),
          attempts: [{ ...detailResponse().attempts[0], errorCategory: "UNRECOGNIZED" }],
        }),
      /error category/,
    );
  });
});

describe("live message history API", () => {
  it("uses human bearer authentication for the tenant list and detail contracts", async () => {
    const requests: Array<{ url: string; authorization: string | null }> = [];
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          authorization: new Headers(init?.headers).get("Authorization"),
        });
        const body = String(input).includes("?")
          ? { items: [], page: 1, pageSize: 20, total: 0 }
          : detailResponse();
        return new Response(JSON.stringify(body), { status: 200 });
      },
    });
    const page = await api.listMessageHistory(query, tenantActor);
    const detail = await api.getMessageHistory(messageId, tenantActor);
    assert.equal(page.total, 0);
    assert.equal(detail?.recipientNormalized, "+966500000000");
    assert.equal(requests[0]?.url, `${base}${messageHistoryListPath(query)}`);
    assert.equal(requests[1]?.url, `${base}/message-history/${messageId}`);
    assert.ok(requests.every((request) => request.authorization === `Bearer ${token}`));
  });

  it("uses the platform target-tenant endpoint and requires a selected tenant", async () => {
    let url = "";
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input) => {
        url = String(input);
        const body = url.includes("?")
          ? { items: [], page: 1, pageSize: 20, total: 0 }
          : detailResponse();
        return new Response(JSON.stringify(body), { status: 200 });
      },
    });
    await api.listMessageHistory(query, platformActor, tenantId);
    assert.equal(url, `${base}${messageHistoryListPath(query, tenantId)}`);
    await api.getMessageHistory(messageId, platformActor, tenantId);
    assert.equal(url, `${base}/tenants/${tenantId}/message-history/${messageId}`);
    await assert.rejects(() => api.listMessageHistory(query, platformActor), /Select a tenant/);
  });

  it("loads combined history from the platform-wide endpoint for a platform actor", async () => {
    let url = "";
    let authorization: string | null = null;
    const api = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async (input, init) => {
        url = String(input);
        authorization = new Headers(init?.headers).get("Authorization");
        return new Response(
          JSON.stringify({
            items: [
              {
                ...detailResponse(),
                tenantId,
                tenantName: "Tenant One",
              },
            ],
            page: 1,
            pageSize: 20,
            total: 1,
          }),
          { status: 200 },
        );
      },
    });
    const page = await api.listAllTenantMessageHistory(query, platformActor);
    assert.equal(url, `${base}${platformMessageHistoryListPath(query)}`);
    assert.equal(authorization, `Bearer ${token}`);
    assert.equal(page.items[0]?.tenantId, tenantId);
    assert.equal(page.items[0]?.tenantName, "Tenant One");
    await assert.rejects(
      () => api.listAllTenantMessageHistory(query, tenantActor),
      /platform administrator/,
    );
  });

  it("treats detail 404 as not found and surfaces auth, network, and server errors", async () => {
    const notFound = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () =>
        new Response(JSON.stringify({ statusCode: 404, message: "Not found" }), { status: 404 }),
    });
    assert.equal(await notFound.getMessageHistory(messageId, tenantActor), null);

    for (const statusCode of [401, 403, 500]) {
      const failing = createLiveApi({
        apiBaseUrl: base,
        getAccessToken: () => token,
        fetchImpl: async () =>
          new Response(JSON.stringify({ statusCode, message: "Request rejected" }), {
            status: statusCode,
          }),
      });
      await assert.rejects(
        () => failing.listMessageHistory(query, tenantActor),
        (error: unknown) => error instanceof ApiError && error.statusCode === statusCode,
      );
    }

    const offline = createLiveApi({
      apiBaseUrl: base,
      getAccessToken: () => token,
      fetchImpl: async () => {
        throw new TypeError("network unavailable");
      },
    });
    await assert.rejects(
      () => offline.listMessageHistory(query, tenantActor),
      /network unavailable/,
    );
  });
});
