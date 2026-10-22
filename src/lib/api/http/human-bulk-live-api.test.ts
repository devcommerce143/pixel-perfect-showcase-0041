import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiveApi } from "./live-api.ts";
import {
  humanBulkBody,
  humanBulkCsvBody,
  humanBulkPath,
  humanBulkKey,
  mapHumanBulkReceipt,
} from "../human-bulk.ts";
import { roleHas } from "../../auth/permissions.ts";
import { ApiError } from "./errors.ts";
const tenant = "11111111-1111-4111-8111-111111111111";
const app = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const actor = { userId: id, role: "operator", tenantId: tenant, name: "Fixture" } as const;
const input = {
  channel: "sms",
  senderId: id,
  recipient: "+15550000000\n+15550000001",
  sms: { body: "private fixture" },
} as const;
const receipt = {
  id,
  tenantId: tenant,
  applicationId: app,
  status: "RECEIVED",
  replay: false,
  itemCount: 2,
  invalidCount: 0,
  pendingCount: 2,
  acceptedCount: 0,
  skippedCount: 0,
  failedCount: 0,
  createdAt: "2026-10-21T00:00:00.000Z",
};
describe("human shared-content bulk creation without persistence or providers", () => {
  it("posts a bounded CSV envelope to the distinct human route, preserving personalized mode", async () => {
    const csv = {
      channel: "sms",
      senderId: id,
      mode: "PERSONALIZED",
      csv: 'recipient,body\n+15550000000,"First, private"',
    } as const;
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.example/api/v1",
      getAccessToken: () => "fixture-human",
      fetchImpl: async (url, init) => {
        assert.equal(
          String(url),
          `https://fixture.example/api/v1/applications/${app}/bulk-jobs/csv`,
        );
        assert.deepEqual(JSON.parse(init?.body as string), humanBulkCsvBody(csv));
        return new Response(JSON.stringify(receipt), { status: 201 });
      },
    });
    await api.createHumanBulkJob(actor, app, csv, "portal:stable-bulk-fixture");
    for (const text of ["", "\0", "x".repeat(2 * 1024 * 1024 + 1), '"'.repeat(1100000)])
      assert.throws(() => humanBulkCsvBody({ ...csv, csv: text }));
    assert.throws(() => humanBulkCsvBody({ ...csv, senderId: "bad" }));
  });
  it("uses separate application routes and requires named platform scope", () => {
    assert.equal(humanBulkPath(actor, app), `/applications/${app}/bulk-jobs`);
    assert.equal(
      humanBulkPath({ ...actor, role: "super_admin", tenantId: null }, app, tenant),
      `/tenants/${tenant}/applications/${app}/bulk-jobs`,
    );
    assert.throws(() => humanBulkPath({ ...actor, role: "super_admin", tenantId: null }, app));
    assert.throws(() => humanBulkPath(actor, app, id));
    assert.throws(() => humanBulkPath({ ...actor, role: "viewer" }, app));
    assert.equal(roleHas("viewer", "messages.bulk.create"), false);
    assert.equal(roleHas("viewer", "messages.bulk.monitor"), true);
  });
  it("validates each recipient and projects only shared content and bounded rows", () => {
    assert.deepEqual(humanBulkBody(input), {
      confirm: true,
      channel: "SMS",
      senderId: id,
      mode: "SHARED",
      sms: input.sms,
      items: [{ recipient: "+15550000000" }, { recipient: "+15550000001" }],
    });
    assert.throws(() => humanBulkBody({ ...input, recipient: "+15550000000\ninvalid" }));
    assert.throws(() => humanBulkBody({ ...input, recipient: "" }));
    assert.throws(() =>
      humanBulkBody({ ...input, recipient: Array(1001).fill("+15550000000").join("\n") }),
    );
  });
  it("allowlists receipt counts/status and rejects cross-scope or fabricated delivery", () => {
    assert.deepEqual(
      mapHumanBulkReceipt({ ...receipt, recipient: "private", delivered: 42 }, actor, app),
      { ...receipt, status: "received" },
    );
    for (const change of [
      { tenantId: id },
      { applicationId: id },
      { status: "DELIVERED" },
      { pendingCount: -1 },
      { acceptedCount: 1 },
      { createdAt: "bad" },
    ])
      assert.throws(() => mapHumanBulkReceipt({ ...receipt, ...change }, actor, app));
  });
  it("sends a human Bearer request with stable idempotency and no machine credential", async () => {
    let captured: RequestInit | undefined;
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.example/api/v1",
      getAccessToken: () => "fixture-human",
      fetchImpl: async (url, init) => {
        assert.equal(String(url), `https://fixture.example/api/v1/applications/${app}/bulk-jobs`);
        captured = init;
        return new Response(JSON.stringify(receipt), { status: 201 });
      },
    });
    await api.createHumanBulkJob(actor, app, input, "portal:stable-bulk-fixture");
    assert.ok(captured);
    assert.equal(new Headers(captured.headers).get("Authorization"), "Bearer fixture-human");
    assert.equal(
      new Headers(captured.headers).get("Idempotency-Key"),
      "portal:stable-bulk-fixture",
    );
    assert.equal(captured.method, "POST");
    assert.deepEqual(JSON.parse(captured.body as string), humanBulkBody(input));
  });
  it("retains an API error without retry or mock fallback", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.example/api/v1",
      getAccessToken: () => "fixture-human",
      fetchImpl: async () => {
        calls++;
        return new Response(JSON.stringify({ message: "Conflict" }), { status: 409 });
      },
    });
    await assert.rejects(
      api.createHumanBulkJob(actor, app, input, "portal:stable-bulk-fixture"),
      (error) => error instanceof ApiError && error.statusCode === 409,
    );
    assert.equal(calls, 1);
  });
  it("isolates identity, role and selected tenant without content in the mutation key", () => {
    const key = humanBulkKey(actor);
    for (const changed of [
      { ...actor, userId: app },
      { ...actor, role: "client_admin" as const },
      { ...actor, tenantId: id },
    ])
      assert.notDeepEqual(humanBulkKey(changed), key);
    assert.notDeepEqual(humanBulkKey(actor, tenant), key);
    assert.doesNotMatch(JSON.stringify(key), /private|155500|body/);
  });
});
