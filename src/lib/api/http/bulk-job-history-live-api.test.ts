import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  bulkHistoryPath,
  bulkHistoryQueryString,
  mapBulkHistoryJob,
  mapBulkHistoryItem,
  mapBulkHistoryPage,
} from "./bulk-job-history-mapper.ts";
import {
  BULK_HISTORY_STATUSES,
  BULK_HISTORY_RESULTS,
  BULK_HISTORY_STATES,
} from "../bulk-job-history-types.ts";

const tenantId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const actor = { role: "viewer", tenantId, userId: id, name: "Viewer" } as const;
const admin = { ...actor, role: "super_admin", tenantId: null } as const;
const query = {
  createdFrom: "2026-10-01T00:00:00.000Z",
  createdTo: "2026-10-20T00:00:00.000Z",
  page: 2,
  pageSize: 10,
};
const row = {
  id,
  tenantId,
  applicationId: id,
  applicationName: "App",
  channel: "SMS",
  mode: "SHARED",
  status: "COMPLETED",
  result: "PARTIAL",
  itemCount: 5,
  invalidCount: 1,
  pendingCount: 0,
  acceptedCount: 3,
  skippedCount: 1,
  failedCount: 0,
  createdAt: query.createdFrom,
  completedAt: query.createdTo,
  cancelledAt: null,
};

describe("bulk monitoring contract", () => {
  it("maps every backend status/result without delivery assumptions", () => {
    for (const status of BULK_HISTORY_STATUSES)
      assert.equal(mapBulkHistoryJob({ ...row, status: status.toUpperCase() }).status, status);
    for (const result of BULK_HISTORY_RESULTS)
      assert.equal(mapBulkHistoryJob({ ...row, result }).result, result);
    const mapped = mapBulkHistoryJob({
      ...row,
      recipient: "private",
      credentialId: "private",
      delivered: 99,
      name: "invented",
    });
    assert.equal(mapped.acceptedCount, 3);
    for (const key of ["recipient", "credentialId", "delivered", "name", "createdBy"])
      assert.equal(key in mapped, false);
    assert.equal(mapBulkHistoryJob({ ...row, tenantName: "Tenant" }, true).tenantName, "Tenant");
    assert.equal(mapBulkHistoryJob(row, false, true).completedAt, query.createdTo);
  });
  it("maps item outcomes and redacts arbitrary failure text", () => {
    for (const state of BULK_HISTORY_STATES)
      assert.equal(
        mapBulkHistoryItem({
          rowNumber: 1,
          state: state.toUpperCase(),
          errorCode: null,
          messageId: null,
        }).state,
        state,
      );
    assert.deepEqual(
      mapBulkHistoryItem({
        rowNumber: 7,
        state: "FAILED",
        errorCode: "secret",
        messageId: null,
        claimToken: "secret",
      }),
      { rowNumber: 7, state: "failed", errorCode: null, messageId: null },
    );
    assert.equal(
      mapBulkHistoryItem({
        rowNumber: 1,
        state: "INVALID",
        errorCode: "RECIPIENT",
        messageId: null,
      }).errorCode,
      "RECIPIENT",
    );
  });
  it("rejects malformed contracts instead of substituting mock data", () => {
    for (const patch of [
      { status: "DELIVERED" },
      { result: { secret: true } },
      { itemCount: -1 },
      { channel: "PUSH" },
      { createdAt: "2026-02-30T00:00:00Z" },
      { id: "bad" },
    ])
      assert.throws(() => mapBulkHistoryJob({ ...row, ...patch }));
    assert.throws(() =>
      mapBulkHistoryPage({ items: [], page: 0, pageSize: 10, total: 0 }, mapBulkHistoryItem),
    );
    assert.throws(() => mapBulkHistoryJob(row, true));
  });
  it("preserves server pagination including empty pages", () => {
    assert.deepEqual(
      mapBulkHistoryPage({ items: [], page: 3, pageSize: 10, total: 12 }, mapBulkHistoryItem),
      { items: [], page: 3, pageSize: 10, total: 12 },
    );
  });
  it("validates ranges, UUID filters and scoped paths", () => {
    assert.equal(bulkHistoryPath("viewer", tenantId), "/bulk-job-history");
    assert.equal(bulkHistoryPath("super_admin", tenantId), `/tenants/${tenantId}/bulk-job-history`);
    assert.throws(() => bulkHistoryPath("super_admin"));
    assert.throws(() => bulkHistoryPath("viewer", undefined, true));
    for (const patch of [
      { page: 0 },
      { pageSize: 101 },
      { createdTo: "2026-11-20T00:00:00Z" },
      { applicationId: "bad" },
    ])
      assert.throws(() => bulkHistoryQueryString({ ...query, ...patch }));
  });
});

describe("live bulk monitoring requests", () => {
  it("uses only Bearer GET routes and forwards job filters and item pagination", async () => {
    const calls: { url: URL; init: RequestInit | undefined }[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "human-token",
      fetchImpl: async (url, init) => {
        const parsed = new URL(String(url));
        calls.push({ url: parsed, init });
        const body = parsed.pathname.endsWith("/items")
          ? {
              items: [{ rowNumber: 3, state: "ACCEPTED", errorCode: null, messageId: id }],
              page: 2,
              pageSize: 10,
              total: 11,
            }
          : parsed.pathname.endsWith(id)
            ? row
            : { items: [{ ...row, tenantName: "Tenant" }], page: 2, pageSize: 10, total: 11 };
        return new Response(JSON.stringify(body), { status: 200 });
      },
    });
    const list = await api.listBulkJobHistory(actor, {
      ...query,
      applicationId: id,
      jobId: id,
      channel: "sms",
      status: "completed",
    });
    assert.equal(list.total, 11);
    await api.listBulkJobHistory(admin, query, tenantId);
    await api.listAllTenantBulkJobHistory(admin, query);
    await api.getBulkJobHistory(admin, id, tenantId);
    const items = await api.listBulkJobHistoryItems(actor, id, {
      page: 2,
      pageSize: 10,
      state: "accepted",
    });
    assert.equal(items.items[0]?.state, "accepted");
    assert.deepEqual(
      calls.map((c) => c.url.pathname),
      [
        "/api/v1/bulk-job-history",
        `/api/v1/tenants/${tenantId}/bulk-job-history`,
        "/api/v1/platform/bulk-job-history",
        `/api/v1/tenants/${tenantId}/bulk-job-history/${id}`,
        `/api/v1/bulk-job-history/${id}/items`,
      ],
    );
    for (const call of calls) {
      assert.equal(call.init?.method, "GET");
      assert.equal(
        (call.init?.headers as Record<string, string>)["Authorization"],
        "Bearer human-token",
      );
      assert.equal(call.init?.body, undefined);
    }
    assert.equal(calls[0]?.url.searchParams.get("applicationId"), id);
    assert.equal(calls[0]?.url.searchParams.get("status"), "COMPLETED");
    assert.equal(calls[4]?.url.searchParams.get("page"), "2");
    assert.equal(calls[4]?.url.searchParams.get("state"), "ACCEPTED");
  });
  it("propagates list, detail and item HTTP failures without mock fallback", async () => {
    for (const status of [401, 403, 404, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://engine.example/api/v1",
        getAccessToken: () => "token",
        fetchImpl: async () => new Response(JSON.stringify({ message: "Failure" }), { status }),
      });
      for (const call of [
        () => api.listBulkJobHistory(actor, query),
        () => api.getBulkJobHistory(actor, id),
        () => api.listBulkJobHistoryItems(actor, id, { page: 1, pageSize: 20 }),
      ])
        await assert.rejects(
          call,
          (error: unknown) => error instanceof ApiError && error.statusCode === status,
        );
    }
  });
  it("rejects unavailable configuration and invalid platform requests before network access", async () => {
    let requests = 0;
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => {
        requests++;
        throw new Error("Unexpected request");
      },
    });
    await assert.rejects(() => api.listAllTenantBulkJobHistory(actor, query));
    await assert.rejects(() => api.getBulkJobHistory(admin, id));
    assert.equal(requests, 0);
    const unavailable = createLiveApi({ apiBaseUrl: null, getAccessToken: () => "token" });
    await assert.rejects(() => unavailable.listBulkJobHistory(actor, query));
  });
});
