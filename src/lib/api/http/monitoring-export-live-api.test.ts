import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import { monitoringExportPath } from "./monitoring-export-mapper.ts";
import { monitoringExportKey } from "../monitoring-export.ts";
import type { MonitoringExport } from "../monitoring-export.ts";
const tenant = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const actor = { userId: id, role: "viewer", tenantId: tenant, name: "Viewer" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
const range = { acceptedFrom: "2026-10-01T00:00:00.000Z", acceptedTo: "2026-10-20T00:00:00.000Z" };
const history: MonitoringExport = {
  kind: "history",
  scope: "tenant",
  query: { ...range, channel: "sms", status: "accepted", applicationId: id },
};
describe("monitoring CSV exports", () => {
  it("uses exact tenant, named-tenant and explicit all-tenant routes without pagination", () => {
    const path = monitoringExportPath(actor, history);
    assert.equal(path.split("?")[0], "/message-history/export");
    const params = new URLSearchParams(path.split("?")[1]);
    assert.equal(params.get("channel"), "SMS");
    assert.equal(params.get("status"), "ACCEPTED");
    assert.equal(params.get("applicationId"), id);
    assert.equal(params.has("page"), false);
    assert.equal(params.has("pageSize"), false);
    assert.match(
      monitoringExportPath(platform, history, tenant),
      new RegExp(`^/tenants/${tenant}/message-history/export\\?`),
    );
    assert.match(
      monitoringExportPath(platform, { ...history, scope: "all-tenants" }),
      /^\/platform\/message-history\/export\?/,
    );
    assert.match(
      monitoringExportPath(platform, { kind: "usage", range }, tenant),
      new RegExp(`^/tenants/${tenant}/usage/export\\?`),
    );
    assert.match(monitoringExportPath(actor, { kind: "usage", range }), /^\/usage\/export\?/);
  });
  it("rejects cross-tenant, missing tenant, implicit platform-wide and invalid range requests before network", () => {
    assert.throws(() => monitoringExportPath(actor, history, id));
    assert.throws(() => monitoringExportPath(platform, history));
    assert.throws(() => monitoringExportPath(actor, { ...history, scope: "all-tenants" }));
    assert.throws(() =>
      monitoringExportPath(platform, { ...history, scope: "all-tenants" }, tenant),
    );
    assert.throws(() =>
      monitoringExportPath(actor, {
        kind: "usage",
        range: { ...range, acceptedTo: "2026-12-01T00:00:00.000Z" },
      }),
    );
    assert.throws(() =>
      monitoringExportPath(actor, {
        ...history,
        query: { ...history.query, applicationId: "bad" },
      }),
    );
  });
  it("separates identity, role, tenant, export type, scope and filter keys", () => {
    const key = monitoringExportKey(actor, history);
    for (const other of [
      monitoringExportKey({ ...actor, userId: tenant }, history),
      monitoringExportKey({ ...actor, tenantId: id }, history),
      monitoringExportKey(platform, history, tenant),
      monitoringExportKey(actor, { kind: "usage", range }),
      monitoringExportKey(actor, { ...history, query: { ...history.query, status: "failed" } }),
    ])
      assert.notDeepEqual(key, other);
  });
  it("downloads CSV with human Bearer auth, CSV accept header and no browser caching", async () => {
    const csv = '\uFEFF"messageId","status"\r\n"id","ACCEPTED"\r\n';
    let captured: RequestInit | undefined;
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async (url, init) => {
        captured = init;
        assert.equal(
          String(url),
          `https://api.example.com/v1${monitoringExportPath(actor, history)}`,
        );
        return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8" } });
      },
    });
    // Fetch strips the Unicode BOM when decoding the response text.
    assert.equal(await api.downloadMonitoringCsv(actor, history), csv.slice(1));
    assert.equal(captured?.method, "GET");
    assert.equal(captured?.cache, "no-store");
    assert.deepEqual(captured?.headers, { Accept: "text/csv", Authorization: "Bearer token" });
    assert.equal(captured?.body, undefined);
  });
  it("rejects missing auth and successful JSON/HTML responses instead of downloading an invalid file", async () => {
    let calls = 0;
    const options = {
      apiBaseUrl: "https://api.example.com/v1",
      fetchImpl: async () => {
        calls++;
        return new Response("{}", { headers: { "content-type": "application/json" } });
      },
    };
    const anonymous = createLiveApi({ ...options, getAccessToken: () => null });
    await assert.rejects(anonymous.downloadMonitoringCsv(actor, history), ApiError);
    assert.equal(calls, 0);
    const authenticated = createLiveApi({ ...options, getAccessToken: () => "token" });
    await assert.rejects(authenticated.downloadMonitoringCsv(actor, history), ApiError);
    assert.equal(calls, 1);
  });
  it("propagates overflow, authorization and network errors without mock fallback", async () => {
    for (const status of [400, 403, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.com/v1",
        getAccessToken: () => "token",
        fetchImpl: async () => new Response('{"message":"unavailable"}', { status }),
      });
      await assert.rejects(
        api.downloadMonitoringCsv(actor, history),
        (error: unknown) => error instanceof ApiError && error.statusCode === status,
      );
    }
  });
  it("keeps downloads outside data caches and guards completion after scope/identity changes", () => {
    const source = readFileSync(
      new URL("../../../components/app/MonitoringCsvButton.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /key=\{JSON.stringify\(monitoringExportKey/);
    assert.match(source, /if \(!active.current\) return/);
    assert.match(source, /gcTime: 0/);
    assert.match(source, /retry: false/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|setQueryData|api\./);
  });
});
