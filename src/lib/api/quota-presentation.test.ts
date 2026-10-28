import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quotaPeriodEnd, quotaPresentation } from "./quota-presentation.ts";

const reading = {
  committed: 30,
  reserved: 10,
  used: 40,
  ceiling: 100,
  band: "none" as const,
  overage: 0,
};

describe("quota presentation", () => {
  it("uses the authoritative used value without combining aggregate and channel counters", () => {
    assert.deepEqual(quotaPresentation(reading), { remaining: 60, percentage: 40 });
    assert.deepEqual(quotaPresentation({ ...reading, used: 50 }), {
      remaining: 50,
      percentage: 50,
    });
  });
  it("shows zero remaining and an unclamped percentage for overage", () => {
    assert.deepEqual(quotaPresentation({ ...reading, used: 120 }), {
      remaining: 0,
      percentage: 120,
    });
  });
  it("distinguishes zero ceilings from missing ceilings without inventing unlimited quota", () => {
    assert.deepEqual(quotaPresentation({ ...reading, ceiling: 0 }), {
      remaining: 0,
      percentage: null,
    });
    assert.deepEqual(quotaPresentation({ ...reading, ceiling: null }), {
      remaining: null,
      percentage: null,
    });
  });
  it("uses the effective overridden ceiling supplied by the server", () => {
    assert.deepEqual(quotaPresentation({ ...reading, ceiling: 200 }), {
      remaining: 160,
      percentage: 20,
    });
  });
  it("resets at the next UTC month including year and leap-year boundaries", () => {
    assert.equal(quotaPeriodEnd("2026-12-01"), "2027-01-01T00:00:00.000Z");
    assert.equal(quotaPeriodEnd("2028-02-01"), "2028-03-01T00:00:00.000Z");
  });
});
