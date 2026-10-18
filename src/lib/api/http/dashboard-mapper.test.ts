import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DashboardResponseError, mapDashboardSummary } from "./dashboard-mapper.ts";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    scope: "tenant",
    tenantId: "11111111-1111-1111-1111-111111111111",
    range: { from: "2026-10-04T00:00:00.000Z", to: "2026-10-18T00:00:00.000Z" },
    messages: { total: 10, delivered: 4, pending: 2, failed: 1, unknown: 1, submitted: 2 },
    trend: [{ date: "2026-10-17", delivered: 4, failed: 1, pending: 2 }],
    channels: [
      { channel: "SMS", count: 5 },
      { channel: "EMAIL", count: 3 },
      { channel: "WHATSAPP", count: 2 },
    ],
    usage: {
      periodStart: "2026-10-01",
      channels: [
        { channel: "SMS", committedCount: 40, reservedCount: 1, monthlyQuota: 50 },
        { channel: "EMAIL", committedCount: 20, reservedCount: 1, monthlyQuota: 30 },
        { channel: "WHATSAPP", committedCount: 20, reservedCount: 3, monthlyQuota: 20 },
      ],
      aggregate: { committedCount: 80, reservedCount: 5, monthlyQuota: 100 },
    },
    ...overrides,
  };
}

describe("dashboard mapper", () => {
  it("maps engine fields without recomputing the total", () => {
    const summary = mapDashboardSummary(payload({
      messages: { total: 12, delivered: 4, pending: 2, failed: 1, unknown: 1, submitted: 2 },
    }));
    assert.equal(summary.scope, "tenant");
    assert.equal(summary.kpis.total, 12);
    assert.equal(summary.kpis.delivered, 4);
    assert.equal(summary.kpis.pending, 2);
    assert.equal(summary.kpis.failed, 1);
    assert.equal(summary.kpis.submitted, 2);
    assert.equal(summary.kpis.unknown, 1);
    assert.equal(summary.kpis.totalDeltaPct, null);
    assert.deepEqual(summary.trend, [{ date: "2026-10-17", delivered: 4, failed: 1, pending: 2 }]);
  });

  it("maps SMS, EMAIL, and WHATSAPP onto the portal channel names", () => {
    const summary = mapDashboardSummary(payload());
    assert.deepEqual(summary.channels, [
      { channel: "sms", count: 5 },
      { channel: "email", count: 3 },
      { channel: "whatsapp", count: 2 },
    ]);
  });

  it("keeps DELIVERED and READ in delivered, and leaves SUBMITTED and UNKNOWN in their own counts", () => {
    const submittedOnly = mapDashboardSummary(payload({
      messages: { total: 3, delivered: 0, pending: 0, failed: 0, unknown: 0, submitted: 3 },
    }));
    assert.equal(submittedOnly.kpis.delivered, 0);
    assert.equal(submittedOnly.kpis.pending, 0);
    assert.equal(submittedOnly.kpis.failed, 0);
    assert.equal(submittedOnly.kpis.submitted, 3);
    assert.equal(submittedOnly.kpis.deliveryRate, 0);

    const unknownOnly = mapDashboardSummary(payload({
      messages: { total: 2, delivered: 0, pending: 0, failed: 0, unknown: 2, submitted: 0 },
    }));
    assert.equal(unknownOnly.kpis.pending, 0);
    assert.equal(unknownOnly.kpis.failed, 0);
    assert.equal(unknownOnly.kpis.unknown, 2);

    const delivered = mapDashboardSummary(payload({
      messages: { total: 8, delivered: 5, pending: 1, failed: 1, unknown: 1, submitted: 0 },
    }));
    assert.equal(delivered.kpis.delivered, 5);
    assert.equal(delivered.kpis.deliveryRate, (5 / 8) * 100);
  });

  it("computes delivery rate from delivered over every message, and omits it when the total is zero", () => {
    const rated = mapDashboardSummary(payload());
    assert.equal(rated.kpis.deliveryRate, (4 / 10) * 100);

    const empty = mapDashboardSummary(payload({
      messages: { total: 0, delivered: 0, pending: 0, failed: 0, unknown: 0, submitted: 0 },
      channels: [
        { channel: "SMS", count: 0 },
        { channel: "EMAIL", count: 0 },
        { channel: "WHATSAPP", count: 0 },
      ],
    }));
    assert.equal(empty.kpis.total, 0);
    assert.equal(empty.kpis.deliveryRate, null);
  });

  it("maps a tenant quota from the aggregate committed count and configured limit", () => {
    const summary = mapDashboardSummary(payload());
    assert.deepEqual(summary.quota, { used: 80, limit: 100 });
  });

  it("does not invent a quota from channel limits or reserved units", () => {
    const summary = mapDashboardSummary(payload({
      usage: {
        periodStart: "2026-10-01",
        channels: [
          { channel: "SMS", committedCount: 40, reservedCount: 9, monthlyQuota: 50 },
        ],
        aggregate: { committedCount: 40, reservedCount: 9, monthlyQuota: null },
      },
    }));
    assert.equal(summary.quota, null);
  });

  it("leaves platform scope without a quota when the limit is null", () => {
    const summary = mapDashboardSummary(payload({
      scope: "platform",
      tenantId: null,
      usage: {
        periodStart: "2026-10-01",
        channels: [],
        aggregate: { committedCount: 80, reservedCount: 0, monthlyQuota: null },
      },
    }));
    assert.equal(summary.scope, "platform");
    assert.equal(summary.quota, null);
    assert.equal(summary.kpis.total, 10);
  });

  it("rejects a platform payload that includes one monthly quota", () => {
    assert.throws(
      () => mapDashboardSummary(payload({
        scope: "platform",
        tenantId: null,
        usage: {
          periodStart: "2026-10-01",
          channels: [],
          aggregate: { committedCount: 80, reservedCount: 0, monthlyQuota: 100 },
        },
      })),
      (error: unknown) => error instanceof DashboardResponseError,
    );
  });

  it("omits a tenant quota when the limit is missing or zero", () => {
    const zero = mapDashboardSummary(payload({
      usage: {
        periodStart: "2026-10-01",
        channels: [],
        aggregate: { committedCount: 4, reservedCount: 0, monthlyQuota: 0 },
      },
    }));
    assert.equal(zero.quota, null);
  });

  it("rejects missing, invalid, and unsupported data", () => {
    assert.throws(() => mapDashboardSummary(null), DashboardResponseError);
    assert.throws(() => mapDashboardSummary(payload({ messages: { total: 1, delivered: 1, pending: 0, failed: 0, unknown: 0 } })), DashboardResponseError);
    assert.throws(() => mapDashboardSummary(payload({
      channels: [{ channel: "PUSH", count: 1 }],
    })), DashboardResponseError);
    assert.throws(() => mapDashboardSummary(payload({
      messages: { total: 1, delivered: 0, pending: 0, failed: -1, unknown: 0, submitted: 0 },
    })), DashboardResponseError);
    assert.throws(() => mapDashboardSummary({ ...payload(), usage: { periodStart: "2026-10-01", channels: [] } }), DashboardResponseError);
  });
});
