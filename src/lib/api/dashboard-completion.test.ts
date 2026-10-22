import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dashboardAuditQuery, dashboardSummaryCsv } from "./dashboard-completion.ts";
import type { DashboardSummary } from "./types.ts";
const tenant = "11111111-1111-4111-8111-111111111111";
const summary: DashboardSummary = {
  scope: "tenant",
  kpis: {
    total: 12,
    delivered: 2,
    pending: 3,
    failed: 1,
    submitted: 4,
    unknown: 2,
    deliveryRate: 100 / 6,
    totalDeltaPct: null,
  },
  trend: [{ date: "2026-10-21", delivered: 2, pending: 3, failed: 1 }],
  channels: [{ channel: "sms", count: 12 }],
  quota: { used: 10, limit: 100 },
};
describe("dashboard read-only operational completion", () => {
  it("bounds audit reads to fourteen UTC calendar days across leap/year boundaries", () => {
    assert.deepEqual(dashboardAuditQuery(new Date("2026-01-01T23:30:00Z")), {
      acceptedFrom: "2025-12-19T00:00:00.000Z",
      acceptedTo: "2026-01-02T00:00:00.000Z",
      page: 1,
      pageSize: 6,
    });
    const leap = dashboardAuditQuery(new Date("2024-03-01T00:01:00Z"));
    assert.equal(leap.acceptedFrom, "2024-02-17T00:00:00.000Z");
    assert.equal((Date.parse(leap.acceptedTo) - Date.parse(leap.acceptedFrom)) / 86400000, 14);
  });
  it("exports separate actual status/channel/day/quota groups without equating submitted to delivered", () => {
    const csv = dashboardSummaryCsv(summary, tenant);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.endsWith("\r\n"));
    assert.ok(csv.includes('"delivered_and_read","2"'));
    assert.ok(csv.includes('"submitted","4"'));
    assert.ok(csv.includes('"unknown","2"'));
    assert.ok(csv.includes('"loaded_quota_snapshot"'));
    assert.ok(csv.includes('"committed_units","10"'));
    assert.ok(csv.includes('"daily_current_message_statuses"'));
    assert.ok(csv.includes('"channel_messages"'));
    assert.ok(csv.includes(`"tenant","${tenant}"`));
    assert.doesNotMatch(csv, /totalDeltaPct|deliveryRate|recipient|secret|creator|idempotency/);
  });
  it("keeps platform exports global regardless of the global tenant selector", () => {
    const csv = dashboardSummaryCsv({ ...summary, scope: "platform", quota: null }, tenant);
    assert.ok(csv.includes('"platform",""'));
    assert.ok(!csv.includes(tenant));
    assert.ok(!csv.includes('"loaded_quota_snapshot"'));
  });
  it("requires an actual tenant identity for live tenant summaries", () => {
    assert.throws(() => dashboardSummaryCsv(summary));
    assert.throws(() => dashboardSummaryCsv(summary, "bad"));
  });
  it("does not invent optional status counts or quota values for missing data", () => {
    const { submitted: _, unknown: __, ...kpis } = summary.kpis;
    const csv = dashboardSummaryCsv({ ...summary, kpis, quota: null }, tenant);
    assert.ok(!csv.includes('"submitted"'));
    assert.ok(!csv.includes('"unknown"'));
    assert.ok(!csv.includes('"monthly_limit"'));
    const mock = dashboardSummaryCsv({
      ...summary,
      scope: undefined,
    } as unknown as DashboardSummary);
    assert.ok(mock.includes('"mock",""'));
  });
  it("quotes strings and neutralizes formula-leading cells including whitespace/control prefixes", () => {
    const csv = dashboardSummaryCsv(
      {
        ...summary,
        trend: [{ date: ' \t\u0001=HYPERLINK("private")', delivered: 0, pending: 0, failed: 0 }],
      },
      tenant,
    );
    assert.ok(csv.includes('"\' \t\u0001=HYPERLINK(""private"")"'));
  });
  it("rejects invalid counters instead of downloading fabricated values", () => {
    for (const total of [-1, NaN, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
      assert.throws(() =>
        dashboardSummaryCsv({ ...summary, kpis: { ...summary.kpis, total } }, tenant),
      );
  });
  it("uses existing query factories for recorded operations and removes live placeholders", () => {
    const widgets = readFileSync(
      new URL("../../features/dashboard/RecordedOperations.tsx", import.meta.url),
      "utf8",
    );
    assert.match(widgets, /queries\.providerMonitoring/);
    assert.match(widgets, /queries\.administrativeAudit/);
    assert.doesNotMatch(
      widgets,
      /\bfetch\(|api\.|testProviderConnection|useMutation|PROVIDER_SYNC/,
    );
    const route = readFileSync(new URL("../../routes/index.tsx", import.meta.url), "utf8");
    assert.match(route, /DashboardRecordedHealth actor/);
    assert.match(route, /DashboardRecentAudit actor/);
    assert.match(route, /DashboardCsvButton/);
    assert.doesNotMatch(route, /dash\.sectionUnavailable/);
  });
});
