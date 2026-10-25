import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiveApi } from "./live-api.ts";
import {
  mapNotificationPage,
  mapNotificationRead,
  mapNotificationsReadAll,
  notificationKey,
} from "../notifications.ts";
import { en } from "../../i18n/en.ts";
import { ar } from "../../i18n/ar.ts";

const id = "11111111-1111-4111-8111-111111111111";
const stamp = "2026-10-25T12:00:00.000Z";
const row = {
  id,
  kind: "ACCESS_CHANGED",
  createdAt: stamp,
  readAt: null,
  credentials: "private",
  rawResponse: "private",
};
const page = { items: [row], page: 1, pageSize: 20, total: 1, unreadCount: 1 };
describe("personal notification API", () => {
  it("marks all via a self-only human PATCH and validates the confirmed count", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "fixture",
      fetchImpl: async (input, init) => {
        calls++;
        assert.equal(String(input), "https://engine.example/api/v1/notifications/read-all");
        assert.equal(init?.method, "PATCH");
        assert.equal(init?.body, "{}");
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture");
        return new Response(JSON.stringify({ updatedCount: 0, secret: "discarded" }), {
          status: 200,
        });
      },
    });
    assert.deepEqual(await api.markAllNotificationsRead(), { updatedCount: 0 });
    assert.equal(calls, 1);
    assert.deepEqual(mapNotificationsReadAll({ updatedCount: 21 }), { updatedCount: 21 });
    for (const value of [null, {}, { updatedCount: -1 }, { updatedCount: "0" }])
      assert.throws(() => mapNotificationsReadAll(value));
  });
  it("allowlists notification fields, genuine zero, unread and read states", () => {
    const mapped = mapNotificationPage(page, 1);
    assert.deepEqual(mapped.items, [
      { id, kind: "ACCESS_CHANGED", context: {}, createdAt: stamp, readAt: null },
    ]);
    assert.equal(
      mapNotificationPage({ ...page, items: [], total: 0, unreadCount: 0 }, 1).unreadCount,
      0,
    );
    assert.equal(
      mapNotificationPage({ ...page, items: [{ ...row, readAt: stamp }], unreadCount: 0 }, 1)
        .items[0]?.readAt,
      stamp,
    );
    assert.deepEqual(mapNotificationRead({ id, readAt: stamp, raw: "secret" }, id), {
      id,
      readAt: stamp,
    });
  });
  it("rejects unknown kinds, missing/malformed data and inconsistent counts", () => {
    for (const body of [
      null,
      {},
      { ...page, unreadCount: 2 },
      { ...page, total: -1 },
      { ...page, page: 2 },
      { ...page, items: [{ ...row, kind: "ARBITRARY_TEXT" }] },
      { ...page, items: [{ ...row, readAt: "bad" }] },
      { ...page, items: [{ ...row, id: id + "\n" }] },
      { ...page, items: [row, row] },
    ])
      assert.throws(() => mapNotificationPage(body, 1));
    assert.throws(() => mapNotificationRead({ id: "other", readAt: stamp }, id));
  });
  it("uses authenticated human requests without user/tenant headers or scope parameters", async () => {
    const calls: Array<{ url: string; method: string; headers: Headers; body: unknown }> = [];
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "fixture-only",
      fetchImpl: async (input, init) => {
        const method = init?.method ?? "GET";
        calls.push({
          url: String(input),
          method,
          headers: new Headers(init?.headers),
          body: init?.body,
        });
        return new Response(JSON.stringify(method === "PATCH" ? { id, readAt: stamp } : page), {
          status: 200,
        });
      },
    });
    await api.listNotifications(1);
    await api.markNotificationRead(id);
    assert.equal(calls[0]?.url, "https://engine.example/api/v1/notifications?page=1");
    assert.equal(calls[1]?.url, `https://engine.example/api/v1/notifications/${id}/read`);
    assert.equal(calls[1]?.method, "PATCH");
    for (const call of calls) {
      assert.equal(call.headers.get("Authorization"), "Bearer fixture-only");
      assert.equal(call.headers.has("x-tenant-id"), false);
      assert.equal(call.headers.has("x-platform-context"), false);
    }
    assert.equal(calls[1]?.body, "{}");
    await assert.rejects(() => api.listNotifications(0));
    await assert.rejects(() => api.markNotificationRead("../other"));
    assert.equal(calls.length, 2);
  });
  it("propagates API and network failures with no mock fallback", async () => {
    for (const fetchImpl of [
      async () => new Response('{"message":"private diagnostic"}', { status: 500 }),
      async () => {
        throw new TypeError("offline");
      },
    ]) {
      const api = createLiveApi({
        apiBaseUrl: "https://engine.example/api/v1",
        getAccessToken: () => "fixture",
        fetchImpl,
      });
      await assert.rejects(() => api.listNotifications(1));
      await assert.rejects(() => api.markNotificationRead(id));
      await assert.rejects(() => api.markAllNotificationsRead());
    }
  });
  it("isolates caches by identity, role, tenant and page and localizes copy", () => {
    const actor = { userId: id, role: "viewer", tenantId: id, name: "Test" } as const;
    for (const change of [{ userId: "other" }, { role: "operator" as const }, { tenantId: null }])
      assert.notDeepEqual(notificationKey(actor), notificationKey({ ...actor, ...change }));
    assert.notDeepEqual(notificationKey(actor, 1), notificationKey(actor, 2));
    for (const key of [
      "notifications.empty",
      "notifications.accessBody",
      "notifications.markRead",
      "notifications.unreadCount",
    ] as const) {
      assert.notEqual(en[key], ar[key]);
      assert.ok(ar[key].trim());
      assert.doesNotMatch(ar[key], /\?{3}/);
    }
  });
});
