import assert from "node:assert/strict";
import { it } from "node:test";
import { readFileSync } from "node:fs";
import {
  bulkHistoryListKey,
  bulkHistoryDetailKey,
  bulkHistoryItemsKey,
} from "./bulk-job-history-query-keys.ts";
import { roleHas } from "../auth/permissions.ts";

const actor = { role: "viewer", tenantId: "tenant-a", userId: "user-a", name: "Viewer" } as const;
const query = {
  createdFrom: "2026-10-01T00:00:00Z",
  createdTo: "2026-10-20T00:00:00Z",
  page: 1,
  pageSize: 20,
};
it("isolates monitoring caches by actor, tenant, platform scope, filters and page", () => {
  const key = bulkHistoryListKey(actor, query, "tenant");
  for (const alternate of [
    bulkHistoryListKey({ ...actor, userId: "user-b" }, query, "tenant"),
    bulkHistoryListKey({ ...actor, tenantId: "tenant-b" }, query, "tenant"),
    bulkHistoryListKey(actor, query, "all-tenants"),
    bulkHistoryListKey(actor, query, "tenant", "tenant-b"),
    bulkHistoryListKey(actor, { ...query, page: 2 }, "tenant"),
  ])
    assert.notDeepEqual(key, alternate);
  assert.notDeepEqual(
    bulkHistoryDetailKey(actor, "job", "tenant-a"),
    bulkHistoryDetailKey(actor, "job", "tenant-b"),
  );
  assert.notDeepEqual(
    bulkHistoryItemsKey(actor, "job", { page: 1, pageSize: 20 }),
    bulkHistoryItemsKey(actor, "job", { page: 2, pageSize: 20 }),
  );
});
it("gives viewers monitoring access without granting mock submission permission", () => {
  assert.equal(roleHas("viewer", "messages.bulk.monitor"), true);
  assert.equal(roleHas("viewer", "messages.bulk"), false);
  const route = readFileSync(new URL("../../routes/messages.bulk.tsx", import.meta.url), "utf8");
  assert.match(route, /apiMode === "mock"[\s\S]*?permission="messages.bulk"/);
  assert.match(route, /permission="messages.bulk.monitor"/);
  const monitoring = readFileSync(
    new URL("../../components/app/BulkJobMonitoring.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    monitoring,
    /bulkMutations|createBulkJob|checkSuppression|useMutation|MockBulkSend/,
  );
});
