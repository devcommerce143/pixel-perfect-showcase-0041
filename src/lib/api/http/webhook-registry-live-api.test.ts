import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  mapRegisteredWebhook,
  mapWebhookHistory,
  webhookBasePath,
  webhookHistoryQuery,
  webhookMutationRequest,
} from "./webhook-registry-mapper.ts";
import { webhookScopeKey, webhookHistoryKey } from "../webhook-registry.ts";
import type { WebhookRegistryOperation } from "../webhook-registry.ts";
import { roleHas } from "../../auth/permissions.ts";
const tenant = "11111111-1111-4111-8111-111111111111",
  app = "22222222-2222-4222-8222-222222222222",
  id = "33333333-3333-4333-8333-333333333333",
  eventId = "44444444-4444-4444-8444-444444444444";
const actor = { userId: id, role: "client_admin", tenantId: tenant, name: "Admin" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
const row = {
  id,
  applicationId: app,
  url: "https://hooks.example.com/events",
  description: null,
  status: "ACTIVE",
  eventTypes: ["message.accepted"],
  secretVersion: 1,
  hasPreviousSecret: false,
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
};
const query = { page: 1, pageSize: 20 };
const attempt = {
  id,
  eventId,
  eventType: "message.accepted",
  state: "PENDING",
  attemptCount: 0,
  lastHttpStatus: null,
  lastErrorCategory: null,
  createdAt: row.createdAt,
  nextAttemptAt: row.createdAt,
  finishedAt: null,
};
describe("webhook registry contracts", () => {
  it("uses explicit named tenant routes and rejects tenant hopping or missing platform scope", () => {
    assert.equal(webhookBasePath(actor, app), `/applications/${app}/webhooks`);
    assert.equal(
      webhookBasePath(platform, app, tenant),
      `/tenants/${tenant}/applications/${app}/webhooks`,
    );
    assert.throws(() => webhookBasePath(platform, app));
    assert.throws(() => webhookBasePath(actor, app, eventId));
  });
  it("isolates cache entries by identity, role, tenant, application, endpoint and page", () => {
    const key = webhookScopeKey(actor, app);
    for (const other of [
      webhookScopeKey({ ...actor, userId: eventId }, app),
      webhookScopeKey({ ...actor, role: "viewer" }, app),
      webhookScopeKey({ ...actor, tenantId: eventId }, app),
      webhookScopeKey(platform, app, tenant),
      webhookScopeKey(actor, eventId),
    ])
      assert.notDeepEqual(key, other);
    assert.notDeepEqual(
      webhookHistoryKey(actor, app, id, query),
      webhookHistoryKey(actor, app, id, { ...query, page: 2 }),
    );
    assert.notDeepEqual(
      webhookHistoryKey(actor, app, id, query),
      webhookHistoryKey(actor, app, eventId, query),
    );
  });
  it("projects only endpoint metadata and rejects mixed application rows and unknown events/status", () => {
    assert.deepEqual(
      mapRegisteredWebhook(
        { ...row, secret: "hidden", signingSecretCiphertext: "hidden", tenant: "hidden" },
        app,
      ),
      row,
    );
    for (const bad of [
      { ...row, applicationId: eventId },
      { ...row, status: "DELETED" },
      { ...row, eventTypes: ["bulk_job.completed"] },
      { ...row, eventTypes: ["message.accepted", "message.accepted"] },
    ])
      assert.throws(() => mapRegisteredWebhook(bad, app));
  });
  it("keeps accepted events distinct and redacts arbitrary stored delivery details", () => {
    const value = mapWebhookHistory(
      {
        ...query,
        total: 1,
        items: [
          { ...attempt, lastErrorCategory: "internal stack and credentials", payload: "sensitive" },
        ],
      },
      query,
    );
    assert.equal(value.items[0]?.eventType, "message.accepted");
    assert.equal(value.items[0]?.lastErrorCategory, null);
    assert.equal("payload" in value.items[0]!, false);
    for (const safe of ["network", "ssrf", "http:503"])
      assert.equal(
        mapWebhookHistory(
          { ...query, total: 1, items: [{ ...attempt, lastErrorCategory: safe }] },
          query,
        ).items[0]?.lastErrorCategory,
        safe,
      );
    assert.throws(() =>
      mapWebhookHistory({ ...query, total: 1, items: [{ ...attempt, state: "DELIVERED" }] }, query),
    );
    assert.throws(() => mapWebhookHistory({ ...query, total: 2, items: [attempt] }, query));
  });
  it("validates pagination and unsafe inputs before network access", () => {
    for (const bad of [
      { page: 0, pageSize: 20 },
      { page: 1, pageSize: 101 },
      { page: 2147483648, pageSize: 20 },
    ])
      assert.throws(() => webhookHistoryQuery(bad));
    for (const url of [
      "http://hooks.example.com",
      "https://127.0.0.1",
      "https://user:pass@hooks.example.com",
      "https://metadata.google.internal",
      "https://hooks.example.com/#secret",
    ])
      assert.throws(() =>
        webhookMutationRequest(actor, app, {
          kind: "create",
          input: { url, eventTypes: ["message.accepted"] },
        }),
      );
  });
  it("keeps tenant and platform write presentation permissions separate", () => {
    assert.equal(roleHas("client_admin", "webhooks.manage"), true);
    assert.equal(roleHas("super_admin", "platform.webhooks.manage"), true);
    assert.equal(roleHas("super_admin", "webhooks.manage"), false);
    for (const role of ["viewer", "operator"] as const) {
      assert.equal(roleHas(role, "webhooks.manage"), false);
      assert.equal(roleHas(role, "platform.webhooks.manage"), false);
    }
  });
  it("performs exact bearer requests for reads and mutations without leaking cached secrets", async () => {
    const operations: WebhookRegistryOperation[] = [
      {
        kind: "create",
        input: { url: row.url, description: "", eventTypes: ["message.accepted"] },
      },
      {
        kind: "update",
        id,
        input: { url: row.url, description: "", eventTypes: ["message.accepted"] },
      },
      ...(["enable", "disable", "rotate", "ping", "delete"] as const).map((kind) => ({ kind, id })),
    ];
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    let response: unknown = [row];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "access-token",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify(response), { status: 200 });
      },
    });
    assert.deepEqual(await api.listWebhookRegistry(platform, app, tenant), [row]);
    response = row;
    assert.deepEqual(await api.getWebhookRegistry(actor, app, id), row);
    response = { ...query, total: 1, items: [attempt] };
    assert.equal((await api.listWebhookDeliveries(actor, app, id, query)).total, 1);
    for (const operation of operations) {
      const expected = webhookMutationRequest(platform, app, operation, tenant);
      response =
        operation.kind === "delete"
          ? { id }
          : operation.kind === "ping"
            ? { eventId }
            : {
                ...row,
                status: operation.kind === "disable" ? "DISABLED" : "ACTIVE",
                secret: "one-time-secret",
              };
      const result = await api.applyWebhookRegistryMutation(platform, app, operation, tenant);
      const request = requests.at(-1)!;
      assert.equal(request.url, `https://api.example.com/v1${expected.path}`);
      assert.equal(request.init?.method, expected.method.toUpperCase());
      assert.equal(
        request.init?.body,
        expected.method === "delete" ? undefined : JSON.stringify(expected.body),
      );
      assert.equal(
        (request.init?.headers as Record<string, string>)["Authorization"],
        "Bearer access-token",
      );
      if (operation.kind === "rotate" || operation.kind === "create")
        assert.equal(result.kind, "secret");
      else assert.equal("secret" in result, false);
    }
  });
  it("propagates API failures without mock fallback", async () => {
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => new Response('{"message":"denied"}', { status: 403 }),
    });
    await assert.rejects(api.listWebhookRegistry(actor, app), ApiError);
    await assert.rejects(api.listWebhookDeliveries(actor, app, id, query), ApiError);
  });
  it("keeps live/mock presentation isolated and secrets outside mutation results", () => {
    const route = readFileSync(new URL("../../../routes/webhooks.tsx", import.meta.url), "utf8");
    const ui = readFileSync(
      new URL("../../../components/app/WebhookRegistry.tsx", import.meta.url),
      "utf8",
    );
    assert.match(route, /apiMode === "mock"/);
    assert.match(route, /user\?\.id.*user\?\.role.*tenantId/);
    assert.match(ui, /gcTime: 0/);
    assert.match(ui, /retry: false/);
    assert.match(ui, /setSecret\(result.secret\)/);
    assert.doesNotMatch(ui, /successRate|lastDelivery|localStorage|sessionStorage|api\./);
  });
});
