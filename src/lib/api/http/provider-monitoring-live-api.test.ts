import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  mapProviderHealthPage,
  mapProviderHealth,
  mapProviderMetadata,
  mapProviderChecks,
  providerMonitorPath,
  providerChecksPath,
  smsPilotControlPath,
  mapSmsPilotControl,
} from "./provider-monitoring-mapper.ts";
import { providerMonitorKey } from "../provider-monitoring.ts";
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const actor = { userId: other, role: "super_admin", tenantId: null, name: "Platform" } as const;
const row = {
  providerAccountId: id,
  code: "sms-account",
  channel: "SMS",
  accountStatus: "ACTIVE",
  state: "UNKNOWN",
  consecutiveSuccesses: 0,
  consecutiveFailures: 0,
  lastCheckedAt: null,
  lastTransitionAt: null,
  lastHttpStatus: null,
  lastLatencyMs: null,
  lastFailureClass: null,
};
const check = {
  id: other,
  providerAccountId: id,
  startedAt: "2026-10-21T00:00:00.000Z",
  finishedAt: "2026-10-21T00:00:00.010Z",
  applied: true,
  succeeded: false,
  httpStatus: 503,
  latencyMs: 10,
  failureClass: "PROVIDER_ERROR",
  stateBefore: "HEALTHY",
  stateAfter: "DEGRADED",
};
describe("platform provider metadata and recorded health", () => {
  it("distinguishes Taqnyat protocols from SMTP and Meta without guessing from channel or account code", () => {
    for (const [channel, transport] of [
      ["SMS", "TAQNYAT_SMS"],
      ["EMAIL", "TAQNYAT_EMAIL"],
      ["EMAIL", "TURBO_SMTP"],
      ["WHATSAPP", "TAQNYAT_WHATSAPP"],
      ["WHATSAPP", "META_GRAPH"],
    ]) {
      assert.equal(mapProviderHealth({ ...row, channel, transport }).transport, transport);
      assert.equal(
        mapProviderMetadata(
          { id, code: "configured", channel, transport, status: "ACTIVE", keyVersion: 1 },
          id,
        ).transport,
        transport,
      );
    }
    assert.equal(mapProviderHealth(row).transport, undefined);
    for (const transport of ["SMTP", "constructor", "TAQNYAT_EMAIL", null])
      assert.throws(() => mapProviderHealth({ ...row, transport }));
    assert.throws(() =>
      mapProviderMetadata(
        {
          id,
          code: "configured",
          channel: "WHATSAPP",
          transport: "TAQNYAT_EMAIL",
          status: "ACTIVE",
          keyVersion: 1,
        },
        id,
      ),
    );
  });
  it("reads only the global pilot gate through human authentication and projects a strict boolean", async () => {
    assert.equal(smsPilotControlPath(actor), "/sms-pilot-controls");
    assert.throws(() => smsPilotControlPath({ ...actor, role: "viewer" }));
    assert.throws(() => smsPilotControlPath({ ...actor, userId: "" }));
    for (const value of ["false", 0, undefined, null])
      assert.throws(() => mapSmsPilotControl({ submissionsEnabled: value }));
    const paths: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "human-token",
      fetchImpl: async (url, init) => {
        paths.push(String(url));
        assert.equal(init?.method, "GET");
        assert.equal(
          (init?.headers as Record<string, string>)["Authorization"],
          "Bearer human-token",
        );
        return new Response(JSON.stringify({ submissionsEnabled: false, secret: "redact" }));
      },
    });
    assert.deepEqual(await api.getSmsPilotControl(actor), { submissionsEnabled: false });
    assert.deepEqual(paths, ["https://api.example.com/v1/sms-pilot-controls"]);
    assert.deepEqual(mapSmsPilotControl({ submissionsEnabled: true }), {
      submissionsEnabled: true,
    });
  });
  it("does not treat an unavailable pilot gate as open or closed and exposes no operational actions", async () => {
    for (const status of [401, 403, 404, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.com/v1",
        getAccessToken: () => "token",
        fetchImpl: async () => new Response('{"message":"unavailable"}', { status }),
      });
      await assert.rejects(api.getSmsPilotControl(actor), ApiError);
    }
    const ui = readFileSync(
      new URL("../../../components/app/SmsPilotControlState.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(ui, /useMutation|\.mutate\(|api\.|sms-pilot-grants|\.put\(|\.post\(/);
    assert.match(ui, /state\.isError/);
    assert.match(ui, /state\.isPending/);
    assert.match(ui, /state\.refetch\(\)/);
    const queries = readFileSync(new URL("../queries.ts", import.meta.url), "utf8");
    assert.match(queries, /providerMonitorKey\(actor\), "smsPilotControl"/);
  });
  it("uses existing cursor endpoints and rejects non-platform actors or invalid pages", () => {
    assert.equal(
      providerMonitorPath(actor, { limit: 20, channel: "SMS", cursor: id }),
      `/provider-health?limit=20&cursor=${id}&channel=SMS`,
    );
    assert.equal(
      providerChecksPath(actor, id, { limit: 10 }),
      `/provider-accounts/${id}/health-checks?limit=10`,
    );
    assert.throws(() =>
      providerMonitorPath({ ...actor, role: "client_admin", tenantId: id }, { limit: 20 }),
    );
    for (const query of [
      { limit: 0 },
      { limit: 101 },
      { limit: 1.5 },
      { limit: 20, cursor: "bad" },
    ])
      assert.throws(() => providerMonitorPath(actor, query));
    assert.throws(() => providerChecksPath(actor, id, { limit: 20, channel: "SMS" }));
  });
  it("keeps unknown observations unknown without inventing metrics or credentials", () => {
    assert.deepEqual(
      mapProviderHealth({
        ...row,
        token: "secret",
        successRate: 99,
        uptime: 100,
        balance: 120,
        region: "invented",
      }),
      row,
    );
    assert.deepEqual(mapProviderHealthPage({ items: [row], nextCursor: null }, { limit: 20 }), {
      items: [row],
      nextCursor: null,
    });
    for (const bad of [
      { ...row, state: "OPERATIONAL" },
      { ...row, accountStatus: "DISABLED" },
      { ...row, lastFailureClass: "private provider payload" },
      { ...row, lastHttpStatus: 999 },
      { ...row, lastLatencyMs: -1 },
    ])
      assert.throws(() => mapProviderHealth(bad));
  });
  it("allowlists metadata and rejects another account's metadata or checks", () => {
    const metadata = { id, code: "sms-account", channel: "SMS", status: "ACTIVE", keyVersion: 2 };
    assert.deepEqual(
      mapProviderMetadata({ ...metadata, credentials: "private", nonce: "private" }, id),
      metadata,
    );
    assert.throws(() => mapProviderMetadata({ ...metadata, id: other }, id));
    assert.deepEqual(
      mapProviderChecks({ items: [{ ...check, responseBody: "secret" }], nextCursor: null }, id, {
        limit: 20,
      }),
      { items: [check], nextCursor: null },
    );
    assert.throws(() =>
      mapProviderChecks({ items: [{ ...check, providerAccountId: other }], nextCursor: null }, id, {
        limit: 20,
      }),
    );
    assert.throws(() =>
      mapProviderChecks(
        { items: [{ ...check, failureClass: "raw-error" }], nextCursor: null },
        id,
        { limit: 20 },
      ),
    );
  });
  it("does not invent totals or cursor progress and rejects duplicate/looping pages", () => {
    assert.deepEqual(mapProviderHealthPage({ items: [row], nextCursor: id }, { limit: 1 }), {
      items: [row],
      nextCursor: id,
    });
    assert.throws(() => mapProviderHealthPage({ items: [row], nextCursor: id }, { limit: 20 }));
    assert.throws(() =>
      mapProviderHealthPage({ items: [row], nextCursor: id }, { limit: 1, cursor: id }),
    );
    assert.throws(() =>
      mapProviderHealthPage({ items: [row, row], nextCursor: null }, { limit: 20 }),
    );
  });
  it("uses human GETs only for lists, metadata, stored state and check history", async () => {
    let response: unknown = { items: [row], nextCursor: null };
    const paths: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async (url, init) => {
        assert.equal(init?.method, "GET");
        assert.equal((init?.headers as Record<string, string>)["Authorization"], "Bearer token");
        paths.push(String(url));
        return new Response(JSON.stringify(response));
      },
    });
    assert.equal(
      (await api.listProviderMonitoring(actor, { limit: 20 })).items[0]?.state,
      "UNKNOWN",
    );
    response = { id, code: "sms-account", channel: "SMS", status: "ACTIVE", keyVersion: 1 };
    await api.getProviderMetadata(actor, id);
    response = row;
    await api.getProviderObservedHealth(actor, id);
    response = { items: [check], nextCursor: null };
    await api.listProviderRecordedChecks(actor, id, { limit: 20 });
    assert.deepEqual(paths, [
      `https://api.example.com/v1/provider-health?limit=20`,
      `https://api.example.com/v1/provider-accounts/${id}`,
      `https://api.example.com/v1/provider-accounts/${id}/health`,
      `https://api.example.com/v1/provider-accounts/${id}/health-checks?limit=20`,
    ]);
  });
  it("rejects mismatched stored-health identities and exposes failures without mock fallback", async () => {
    const mismatch = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => new Response(JSON.stringify({ ...row, providerAccountId: other })),
    });
    await assert.rejects(mismatch.getProviderObservedHealth(actor, id));
    for (const status of [401, 403, 404, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.com/v1",
        getAccessToken: () => "token",
        fetchImpl: async () => new Response('{"message":"unavailable"}', { status }),
      });
      await assert.rejects(api.listProviderMonitoring(actor, { limit: 20 }), ApiError);
    }
  });
  it("isolates authenticated identity and platform scope while each query adds account and cursor filters", () => {
    const key = providerMonitorKey(actor);
    assert.notDeepEqual(key, providerMonitorKey({ ...actor, userId: id }));
    assert.notDeepEqual(key, providerMonitorKey({ ...actor, role: "viewer", tenantId: id }));
    const queries = readFileSync(new URL("../queries.ts", import.meta.url), "utf8");
    assert.match(queries, /providerMonitorKey\(actor\), "checks", id, query/);
    assert.match(queries, /providerMonitorKey\(actor\), "accounts", query/);
  });
  it("keeps live pages separate from mock probes and fabricated usage metrics", () => {
    const ui = readFileSync(
      new URL("../../../components/app/ProviderMonitoring.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      ui,
      /testProviderConnection|useMutation|successRate|uptime|billing|balance|api\./,
    );
    for (const page of ["platform.providers", "platform.health"]) {
      const route = readFileSync(new URL(`../../../routes/${page}.tsx`, import.meta.url), "utf8");
      assert.match(route, /apiMode === "mock"/);
      assert.match(route, /user\?\.id.*user\?\.role/);
    }
  });
});
