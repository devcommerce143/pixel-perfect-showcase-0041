import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import { mapUsageReport, usageRangeQuery, usageReportPath } from "./usage-report-mapper.ts";
import { usageReportCsv, usageReportKey } from "../usage-report.ts";

const tenantId = "11111111-1111-4111-8111-111111111111";
const otherTenant = "22222222-2222-4222-8222-222222222222";
const actor = { role: "viewer", tenantId, userId: otherTenant, name: "Viewer" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
const range = { acceptedFrom: "2026-09-25T00:00:00.000Z", acceptedTo: "2026-10-10T00:00:00.000Z" };
const response = {
  ...range,
  messageCounts: {
    byStatus: [
      { status: "SUBMITTED", count: 2 },
      { status: "UNKNOWN", count: 1 },
    ],
    byChannel: [{ channel: "SMS", count: 3 }],
    byApplication: [
      { applicationId: otherTenant, channel: "SMS", status: "SUBMITTED", count: 2 },
      { applicationId: otherTenant, channel: "SMS", status: "UNKNOWN", count: 1 },
    ],
  },
  quota: [
    { periodStart: "2026-09-01", counterScope: "AGGREGATE", reservedCount: 10, committedCount: 40 },
    { periodStart: "2026-10-01", counterScope: "SMS", reservedCount: 1, committedCount: 2 },
  ],
};

describe("real usage report semantics", () => {
  it("keeps current message status groups and independent monthly quota counters", () => {
    const report = mapUsageReport(response, range);
    assert.deepEqual(report.messageCounts.byStatus, [
      { status: "submitted", count: 2 },
      { status: "unknown", count: 1 },
    ]);
    assert.equal(report.quota[0]?.committedCount, 40);
    assert.equal(report.quota[0]?.counterScope, "AGGREGATE");
    for (const key of ["delivered", "deliveryRate", "trend", "cost", "billingTotal"])
      assert.equal(key in report, false);
    assert.deepEqual(
      mapUsageReport(
        { ...range, messageCounts: { byStatus: [], byChannel: [], byApplication: [] }, quota: [] },
        range,
      ).quota,
      [],
    );
  });
  it("rejects malformed, mismatched and duplicate report rows", () => {
    for (const patch of [
      { acceptedFrom: "2026-09-26T00:00:00.000Z" },
      { messageCounts: { ...response.messageCounts, byStatus: [{ status: "SENT", count: 1 }] } },
      { messageCounts: { ...response.messageCounts, byChannel: [{ channel: "SMS", count: -1 }] } },
      { quota: [{ ...response.quota[0], periodStart: "2026-08-01" }] },
      { quota: [response.quota[0], response.quota[0]] },
    ])
      assert.throws(() => mapUsageReport({ ...response, ...patch }, range));
    assert.throws(() => usageRangeQuery({ ...range, acceptedTo: "2026-11-01T00:00:00Z" }));
    assert.throws(() => usageRangeQuery({ ...range, acceptedFrom: "2026-02-30T00:00:00Z" }));
  });
  it("uses trusted tenant paths and requires explicit target for platform scope", () => {
    assert.match(usageReportPath(actor, range), /^\/usage\?/);
    assert.match(
      usageReportPath(platform, range, tenantId),
      new RegExp(`^/tenants/${tenantId}/usage\\?`),
    );
    assert.throws(() => usageReportPath(platform, range));
    assert.throws(() => usageReportPath(actor, range, otherTenant));
  });
  it("isolates identity, tenant and date-window caches", () => {
    assert.notDeepEqual(
      usageReportKey(actor, range),
      usageReportKey({ ...actor, userId: tenantId }, range),
    );
    assert.notDeepEqual(
      usageReportKey(actor, range),
      usageReportKey({ ...actor, tenantId: otherTenant }, range),
    );
    assert.notDeepEqual(
      usageReportKey(platform, range, tenantId),
      usageReportKey(platform, range, otherTenant),
    );
    assert.notDeepEqual(
      usageReportKey(actor, range),
      usageReportKey(actor, { ...range, acceptedTo: "2026-10-11T00:00:00Z" }),
    );
  });
  it("exports sections with truthful semantics and protects formula-leading cells", () => {
    const report = mapUsageReport(response, range);
    const csv = usageReportCsv(report);
    assert.match(csv, /whole_month_quota/);
    assert.match(csv, /by_application/);
    assert.match(csv, /submitted/);
    assert.doesNotMatch(csv, /delivered|recipient|body|providerTemplateId/);
    const malicious = {
      ...report,
      messageCounts: {
        ...report.messageCounts,
        byApplication: [{ ...report.messageCounts.byApplication[0]!, applicationId: "=formula" }],
      },
    };
    assert.match(usageReportCsv(malicious), /"'=formula"/);
  });
});

describe("live usage HTTP requests", () => {
  it("loads tenant and named-tenant reports using human Bearer GET", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "human-token",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify(response), { status: 200 });
      },
    });
    assert.equal((await api.getUsageReport(actor, range)).messageCounts.byChannel[0]?.count, 3);
    await api.getUsageReport(platform, range, tenantId);
    assert.deepEqual(
      calls.map((c) => new URL(c.url).pathname),
      ["/api/v1/usage", `/api/v1/tenants/${tenantId}/usage`],
    );
    for (const call of calls) {
      assert.equal(call.init?.method, "GET");
      assert.equal(
        (call.init?.headers as Record<string, string>)["Authorization"],
        "Bearer human-token",
      );
      assert.equal(new URL(call.url).searchParams.get("acceptedFrom"), range.acceptedFrom);
    }
  });
  it("propagates authentication, permission, server and malformed response failures", async () => {
    for (const status of [401, 403, 404, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://engine.example/api/v1",
        getAccessToken: () => "token",
        fetchImpl: async () => new Response("{}", { status }),
      });
      await assert.rejects(
        () => api.getUsageReport(actor, range),
        (error: unknown) => error instanceof ApiError && error.statusCode === status,
      );
    }
    const malformed = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    await assert.rejects(() => malformed.getUsageReport(actor, range));
  });
});
