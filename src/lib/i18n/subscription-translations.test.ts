import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ar } from "./ar.ts";
import { en } from "./en.ts";

describe("subscription management translations", () => {
  it("keeps English and Arabic subscription-management keys in parity", () => {
    const englishKeys = Object.keys(en).filter(
      (key) =>
        key.startsWith("ten.subscription") ||
        key.startsWith("ten.historyPage") ||
        key.startsWith("ten.inheritedFromPlan") ||
        key.startsWith("ten.overrideValue") ||
        key.startsWith("ten.inheritPlanValue") ||
        key.startsWith("ten.saveSubscription") ||
        key.startsWith("ten.invalidTpsOverride") ||
        key.startsWith("ten.invalidMonthlyOverride") ||
        key.startsWith("ten.enabledOverride") ||
        key.startsWith("ten.channelOverride") ||
        key.startsWith("ten.saveChannelOverride") ||
        key.startsWith("ten.removeChannelOverride") ||
        key.startsWith("ten.channelOverrideRestriction") ||
        key.startsWith("ten.immediateCancel"),
    );
    const arabicKeys = Object.keys(ar).filter((key) => englishKeys.includes(key));
    assert.deepEqual(arabicKeys.sort(), englishKeys.sort());
    for (const key of englishKeys) {
      assert.ok(en[key as keyof typeof en].length > 0);
      assert.ok(ar[key as keyof typeof ar].length > 0);
    }
  });
});
