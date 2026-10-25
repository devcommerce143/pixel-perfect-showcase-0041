import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ar } from "../i18n/ar.ts";
import { en } from "../i18n/en.ts";
import {
  normalizePlanListQuery,
  planListPath,
  planTenantCountLabel,
  plansCatalogSource,
  slicePlanPage,
} from "./plans-catalog.ts";

const COPY_KEYS = ["plans.emptyTitle", "plans.emptyBody"] as const;

describe("plan catalog source", () => {
  it("omits unavailable counts without inventing zero or a failure message", () => {
    const unexpected = () => {
      throw new Error("Unknown counts must not be formatted");
    };
    for (const value of [null, -1, NaN, 1.5])
      assert.equal(planTenantCountLabel(value, unexpected), undefined);
  });

  it("preserves known zero and positive counts with localized labels", () => {
    for (const dictionary of [en, ar]) {
      for (const count of [0, 3]) {
        assert.equal(
          planTenantCountLabel(count, (value) =>
            dictionary["plans.tenants"].replace("{count}", String(value)),
          ),
          dictionary["plans.tenants"].replace("{count}", String(count)),
        );
      }
    }
  });
  it("keeps mock mode on the local catalog", () => {
    assert.equal(plansCatalogSource("mock"), "mock-catalog");
    assert.equal(plansCatalogSource("live"), "live-endpoint");
  });

  it("sends only page and pageSize and caps the page at 100", () => {
    assert.equal(planListPath({ page: 2, pageSize: 50 }), "/plans?page=2&pageSize=50");
    assert.equal(planListPath({ pageSize: 250 }), "/plans?page=1&pageSize=100");
    assert.deepEqual(normalizePlanListQuery({}), { page: 1, pageSize: 20 });
    const url = new URL(`https://engine.example/api/v1${planListPath({ page: 3, pageSize: 100 })}`);
    assert.deepEqual([...url.searchParams.keys()], ["page", "pageSize"]);
  });

  it("pages the mock catalog without changing its tenant counts", () => {
    const rows = [
      { id: "standard", tenants: 2 },
      { id: "business", tenants: 5 },
      { id: "enterprise", tenants: 3 },
    ];
    const page = slicePlanPage(rows, { page: 2, pageSize: 2 });
    assert.equal(page.total, 3);
    assert.equal(page.page, 2);
    assert.equal(page.pageSize, 2);
    assert.deepEqual(page.items, [{ id: "enterprise", tenants: 3 }]);
    assert.equal(slicePlanPage(rows).items.length, 3);
    assert.equal(slicePlanPage(rows).items[0]?.tenants, 2);
  });

  it("has distinct English and Arabic copy for the catalog states", () => {
    for (const key of COPY_KEYS) {
      assert.equal(en[key].trim().length > 0, true);
      assert.equal(ar[key].trim().length > 0, true);
      assert.notEqual(ar[key], en[key]);
    }
  });
});
