import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ar } from "../i18n/ar.ts";
import { en } from "../i18n/en.ts";
import { dashboardQuotaSource, quotaWarningCopyKey, type QuotaWarningCopyKey } from "./dashboard-quota.ts";

const COPY_KEYS = [
  "dash.quota.hardStop.80",
  "dash.quota.hardStop.90",
  "dash.quota.hardStop.100",
  "dash.quota.softCap.80",
  "dash.quota.softCap.90",
  "dash.quota.softCap.100",
  "dash.quotaUnconfiguredTitle",
  "dash.quotaUnconfiguredBody",
  "dash.quotaPolicy.hardStop",
  "dash.quotaPolicy.softCap",
  "dash.quotaOverageLabel",
  "dash.quotaSeparate",
  "dash.unconfiguredTenants",
] as const;

describe("dashboard quota warnings", () => {
  it("keeps mock mode on the local usage summary", () => {
    assert.equal(dashboardQuotaSource("mock"), "mock-usage");
    assert.equal(dashboardQuotaSource("live"), "live-endpoint");
  });

  it("uses the backend band and policy instead of one exhausted message", () => {
    assert.equal(quotaWarningCopyKey("hard_stop", "100"), "dash.quota.hardStop.100");
    assert.equal(quotaWarningCopyKey("soft_cap", "100"), "dash.quota.softCap.100");
    assert.notEqual(quotaWarningCopyKey("hard_stop", "100"), quotaWarningCopyKey("soft_cap", "100"));
    assert.equal(quotaWarningCopyKey("soft_cap", "80"), "dash.quota.softCap.80");
    assert.equal(quotaWarningCopyKey("hard_stop", "none"), null);
    assert.equal(quotaWarningCopyKey(null, "100"), null);
  });

  it("has distinct English and Arabic copy for every warning", () => {
    for (const key of COPY_KEYS) {
      assert.equal(en[key].trim().length > 0, true);
      assert.equal(ar[key].trim().length > 0, true);
      assert.notEqual(ar[key], en[key]);
    }
    const hardStop = quotaWarningCopyKey("hard_stop", "100");
    const softCap = quotaWarningCopyKey("soft_cap", "100");
    assert.ok(hardStop && softCap);
    assert.notEqual(en[hardStop as QuotaWarningCopyKey], en[softCap as QuotaWarningCopyKey]);
    assert.notEqual(ar[hardStop as QuotaWarningCopyKey], ar[softCap as QuotaWarningCopyKey]);
  });
});
