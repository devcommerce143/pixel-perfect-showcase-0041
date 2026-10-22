import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { readHistoryApplicationOptions } from "./history-application-options.ts";
import {
  buildMessageHistoryQuery,
  messageHistoryListPath,
  platformMessageHistoryListPath,
} from "./http/message-history-mapper.ts";
import {
  tenantMessageHistoryQueryKey,
  allTenantMessageHistoryQueryKey,
  messageHistoryDetailQueryKey,
  historyApplicationScope,
} from "./message-history-query-keys.ts";
import type { DolfConnectApi } from "./client.ts";
import type { Application } from "./types.ts";
import { ApiError } from "./http/errors.ts";
const tenant = "11111111-1111-4111-8111-111111111111",
  application = "22222222-2222-4222-8222-222222222222",
  user = "33333333-3333-4333-8333-333333333333",
  other = "44444444-4444-4444-8444-444444444444";
const actor = { userId: user, role: "viewer", tenantId: tenant, name: "Viewer" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
describe("Message History application filters and identity scopes", () => {
  it("preserves validated application UUID through date/query construction and both history paths", () => {
    const query = buildMessageHistoryQuery(
      { from: "2026-10-01", through: "2026-10-20" },
      { page: 1, pageSize: 20, applicationId: application },
    );
    assert.equal(query.applicationId, application);
    assert.equal(
      new URLSearchParams(messageHistoryListPath(query).split("?")[1]).get("applicationId"),
      application,
    );
    assert.equal(
      new URLSearchParams(platformMessageHistoryListPath(query).split("?")[1]).get("applicationId"),
      application,
    );
    assert.throws(() => messageHistoryListPath({ ...query, applicationId: "bad" }), RangeError);
    assert.throws(
      () =>
        buildMessageHistoryQuery(
          { from: "2026-10-01", through: "2026-10-20" },
          { page: 1, pageSize: 20, applicationId: "" },
        ),
      RangeError,
    );
  });
  it("isolates list/detail caches by authenticated identity plus scope, filters and pages", () => {
    const query = buildMessageHistoryQuery(
      { from: "2026-10-01", through: "2026-10-20" },
      { page: 1, pageSize: 20, applicationId: application },
    );
    assert.notDeepEqual(
      tenantMessageHistoryQueryKey(query, actor),
      tenantMessageHistoryQueryKey(query, { ...actor, userId: other }),
    );
    assert.notDeepEqual(
      allTenantMessageHistoryQueryKey(query, platform),
      allTenantMessageHistoryQueryKey(query, { ...platform, userId: other }),
    );
    assert.notDeepEqual(
      messageHistoryDetailQueryKey(application, actor),
      messageHistoryDetailQueryKey(application, { ...actor, userId: other }),
    );
    assert.notDeepEqual(
      tenantMessageHistoryQueryKey(query, actor),
      tenantMessageHistoryQueryKey({ ...query, applicationId: other }, actor),
    );
    assert.notDeepEqual(
      tenantMessageHistoryQueryKey(query, actor),
      tenantMessageHistoryQueryKey({ ...query, page: 2 }, actor),
    );
    assert.notDeepEqual(
      historyApplicationScope(platform, tenant),
      historyApplicationScope(platform, undefined, true),
    );
    assert.notDeepEqual(
      historyApplicationScope(platform, tenant),
      historyApplicationScope(platform, other),
    );
  });
  it("uses backend pages for tenant, named-tenant and all-tenant application options", async () => {
    const seen: Array<unknown[]> = [];
    const api: Pick<DolfConnectApi, "listApplicationsPage" | "listAllTenantApplications"> = {
      listApplicationsPage: async (...args) => {
        seen.push(args);
        return { items: [], page: args[1].page ?? 1, pageSize: 20, total: 0 };
      },
      listAllTenantApplications: async (...args) => {
        seen.push(args);
        return { items: [], page: args[1].page ?? 1, pageSize: 20, total: 0 };
      },
    };
    await readHistoryApplicationOptions(api, actor, 2);
    await readHistoryApplicationOptions(api, platform, 3, tenant);
    await readHistoryApplicationOptions(api, platform, 4, undefined, true);
    assert.deepEqual(seen, [
      [actor, { page: 2, pageSize: 20 }, undefined],
      [platform, { page: 3, pageSize: 20 }, tenant],
      [platform, { page: 4, pageSize: 20 }],
    ]);
    await assert.rejects(readHistoryApplicationOptions(api, actor, 1, other));
    await assert.rejects(readHistoryApplicationOptions(api, actor, 1, undefined, true));
    await assert.rejects(readHistoryApplicationOptions(api, platform, 1));
    await assert.rejects(readHistoryApplicationOptions(api, platform, 1, tenant, true));
    assert.equal(seen.length, 3);
  });
  it("rejects a foreign-tenant option response and propagates API failures instead of fixtures", async () => {
    const foreign = { tenantId: other } as Application;
    const api: Pick<DolfConnectApi, "listApplicationsPage" | "listAllTenantApplications"> = {
      listApplicationsPage: async () => ({ items: [foreign], page: 1, pageSize: 20, total: 1 }),
      listAllTenantApplications: async () => {
        throw new ApiError({ statusCode: 403, message: "denied" });
      },
    };
    await assert.rejects(readHistoryApplicationOptions(api, actor, 1), /tenant mismatch/);
    await assert.rejects(
      readHistoryApplicationOptions(api, platform, 1, undefined, true),
      ApiError,
    );
  });
  it("keeps selection bound to identity/tenant scope and preserves both CSV export choices", () => {
    const route = readFileSync(new URL("../../routes/messages.index.tsx", import.meta.url), "utf8");
    assert.match(route, /applicationSelection\?\.scope === applicationScope/);
    assert.match(route, /key=\{applicationScope\}/);
    assert.match(route, /messageHistoryPageCsv/);
    assert.match(route, /MonitoringCsvButton/);
    const component = readFileSync(
      new URL("../../components/app/MessageHistoryApplicationFilter.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(component, /api\.|mock|\.slice\(/);
  });
});
