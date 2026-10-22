import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiveApi } from "./live-api.ts";
import { administrativeAuditKey } from "../administrative-audit.ts";
import {
  auditBasePath,
  auditDetailPath,
  auditQueryString,
  mapAdministrativeAudit,
  mapAdministrativeAuditPage,
  mapAuditRetention,
  auditRetentionRequest,
} from "./administrative-audit-mapper.ts";
import { ApiError } from "./errors.ts";

const tenantId = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const actor = { role: "viewer", tenantId, userId: id, name: "Viewer" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
const query = {
  acceptedFrom: "2026-10-01T00:00:00.000Z",
  acceptedTo: "2026-10-20T00:00:00.000Z",
  page: 1,
  pageSize: 20,
};
const event = {
  id,
  tenantId,
  actorKind: "HUMAN",
  actorUserId: id,
  actorCredentialId: null,
  action: "template.create",
  resourceType: "template",
  resourceId: id,
  outcome: "SUCCESS",
  correlationId: "request-123",
  details: { nextState: "DRAFT", token: "secret", body: "secret" },
  createdAt: "2026-10-10T00:00:00.000Z",
};
const policy = {
  retentionDays: 365,
  updatedAt: event.createdAt,
  complianceConfirmationPending: true,
  deletionEnabled: false,
};

describe("administrative audit safe contracts", () => {
  it("admits the exact content-version, approved live-test and binding-maintenance actions", () => {
    for (const [action, resourceType] of [
      ["content-template.create", "template"],
      ["content-template.ready", "template"],
      ["content-template.retire", "template"],
      ["provider.live-test.started", "provider"],
      ["provider.live-test.finished", "provider"],
      ["sender-binding.update", "sender-binding"],
    ] as const) {
      const result = mapAdministrativeAudit(
        { ...event, action, resourceType, actorKind: "SYSTEM", actorUserId: null },
        tenantId,
      );
      assert.equal(result.action, action);
      assert.equal(result.actorUserId, null);
      assert.ok(auditQueryString({ ...query, action }).includes(`action=${action}`));
      assert.doesNotMatch(JSON.stringify(result.details), /secret|token|body/);
    }
    assert.throws(() =>
      mapAdministrativeAudit({ ...event, action: "content-template.internal-debug" }, tenantId),
    );
  });
  it("allowlists reviewed email evidence references and states without leaking raw evidence", () => {
    const result = mapAdministrativeAudit(
      {
        ...event,
        action: "sender.email-evidence.record",
        resourceType: "sender",
        details: {
          evidenceReference: "review:CASE-1",
          evidenceSource: "OPERATOR_REVIEW",
          previousDomainState: "NOT_CONFIGURED",
          nextDomainState: "VERIFIED",
          nextSpfState: "VERIFIED",
          nextDkimState: "FAILED",
          rawEvidence: "private",
          domain: "private.test",
          token: "private",
        },
      },
      tenantId,
    );
    assert.deepEqual(result.details, {
      evidenceReference: "review:CASE-1",
      evidenceSource: "OPERATOR_REVIEW",
      previousDomainState: "NOT_CONFIGURED",
      nextDomainState: "VERIFIED",
      nextSpfState: "VERIFIED",
      nextDkimState: "FAILED",
    });
    const redacted = mapAdministrativeAudit(
      {
        ...event,
        action: "sender.email-evidence.record",
        resourceType: "sender",
        details: {
          evidenceReference: "https://private.test?token=secret",
          evidenceSource: "PROVIDER_SYNC",
          nextSpfState: "INTERNAL_ERROR",
        },
      },
      tenantId,
    );
    assert.deepEqual(redacted.details, {});
  });
  it("admits only explicit configuration references and lifecycle values", () => {
    const route = mapAdministrativeAudit(
      {
        ...event,
        action: "provider-route.member-add",
        resourceType: "route-member",
        details: {
          routeId: tenantId,
          providerAccountId: id,
          priority: 1,
          enabled: false,
          providerSenderName: "private",
          token: "private",
        },
      },
      tenantId,
    );
    assert.deepEqual(route.details, {
      routeId: tenantId,
      providerAccountId: id,
      priority: 1,
      enabled: false,
    });
    const pilot = mapAdministrativeAudit(
      {
        ...event,
        action: "sms-pilot-grant.arm",
        resourceType: "pilot-grant",
        details: {
          previousState: "PENDING",
          nextState: "ARMED",
          messageId: id,
          recipient: "private",
          confirmationCode: "private",
        },
      },
      tenantId,
    );
    assert.deepEqual(pilot.details, {
      previousState: "PENDING",
      nextState: "ARMED",
      messageId: id,
    });
  });
  it("allowlists failover references and reasons without accepting arbitrary provider detail", () => {
    const row = mapAdministrativeAudit(
      {
        ...event,
        action: "sms-failover.decision",
        resourceType: "message",
        details: {
          routeId: id,
          providerAccountId: tenantId,
          nextProviderAccountId: id,
          continued: true,
          failoverReason: "insufficient_balance",
          response: "private",
          balance: 123,
        },
      },
      tenantId,
    );
    assert.deepEqual(row.details, {
      routeId: id,
      providerAccountId: tenantId,
      nextProviderAccountId: id,
      continued: true,
      failoverReason: "insufficient_balance",
    });
    assert.deepEqual(
      mapAdministrativeAudit(
        {
          ...event,
          action: "quota.reserve",
          details: {
            nextReservationState: "RESERVED",
            failoverReason: "private",
            nextProviderAccountId: "private",
          },
        },
        tenantId,
      ).details,
      { nextReservationState: "RESERVED" },
    );
  });
  it("keeps only explicit reservation states in UNKNOWN resolution events", () => {
    const row = mapAdministrativeAudit(
      {
        ...event,
        action: "dispatch.unknown.resolve",
        resourceType: "message",
        details: {
          previousState: "UNKNOWN",
          nextState: "SUBMITTED",
          previousReservationState: "RESERVED",
          nextReservationState: "COMMITTED",
          evidenceReference: "private",
          providerMessageId: "private",
        },
      },
      tenantId,
    );
    assert.deepEqual(row.details, {
      previousState: "UNKNOWN",
      nextState: "SUBMITTED",
      previousReservationState: "RESERVED",
      nextReservationState: "COMMITTED",
    });
    assert.deepEqual(
      mapAdministrativeAudit(
        {
          ...event,
          details: {
            previousReservationState: "private",
            nextReservationState: "DELIVERED",
          },
        },
        tenantId,
      ).details,
      {},
    );
  });
  it("rejects page counts that contradict the returned rows", () => {
    assert.throws(() =>
      mapAdministrativeAuditPage(
        { items: [event], total: 0, page: 1, pageSize: 20 },
        query,
        tenantId,
      ),
    );
    assert.throws(() =>
      mapAdministrativeAuditPage({ items: [], total: 1, page: 1, pageSize: 20 }, query, tenantId),
    );
    assert.deepEqual(
      mapAdministrativeAuditPage(
        { items: [], total: 1, page: 2, pageSize: 20 },
        { ...query, page: 2 },
        tenantId,
      ).items,
      [],
    );
  });
  it("identifies machine credential actors without accepting ambiguous actor identities", () => {
    const machine = { ...event, actorKind: "MACHINE", actorUserId: null, actorCredentialId: id };
    assert.equal(mapAdministrativeAudit(machine, tenantId).actorCredentialId, id);
    assert.throws(() => mapAdministrativeAudit({ ...machine, actorUserId: id }, tenantId));
    assert.throws(() => mapAdministrativeAudit({ ...machine, actorCredentialId: null }, tenantId));
    assert.throws(() => mapAdministrativeAudit({ ...event, actorCredentialId: id }, tenantId));
  });
  it("allowlists events and redacted metadata without fabricating identity or IP data", () => {
    const row = mapAdministrativeAudit({ ...event, ip: "secret", name: "secret" }, tenantId);
    assert.deepEqual(row.details, { nextState: "DRAFT" });
    assert.equal("ip" in row, false);
    assert.equal("name" in row, false);
    for (const patch of [
      { action: "secret" },
      { resourceType: "secret" },
      { outcome: "secret" },
      { actorKind: "secret" },
      { tenantId: id },
    ])
      assert.throws(() => mapAdministrativeAudit({ ...event, ...patch }, tenantId));
    assert.deepEqual(
      mapAdministrativeAuditPage(
        { items: [event], page: 1, pageSize: 20, total: 1 },
        query,
        tenantId,
      ).items,
      [row],
    );
    assert.throws(() =>
      mapAdministrativeAuditPage({ items: [event], page: 2, pageSize: 20, total: 1 }, query),
    );
  });
  it("isolates tenant and explicit platform paths and prevents tenant hopping", () => {
    assert.equal(auditBasePath(actor), "/audit-events");
    assert.equal(auditBasePath(platform), "/platform/audit-events");
    assert.equal(
      auditDetailPath(platform, id, tenantId),
      `/tenants/${tenantId}/audit-events/${id}`,
    );
    assert.throws(() => auditBasePath(actor, id));
    assert.throws(() => auditDetailPath(platform, id));
    for (const patch of [
      { page: 0 },
      { pageSize: 101 },
      { outcome: "other" },
      { action: "other" },
      { actorUserId: "bad" },
      { acceptedFrom: "2026-01-01T00:00:00Z" },
    ])
      assert.throws(() => auditQueryString({ ...query, ...patch } as typeof query));
  });
  it("isolates identity, scope, tenant, filters and pagination in keys", () => {
    const key = administrativeAuditKey(actor, query);
    assert.notDeepEqual(key, administrativeAuditKey({ ...actor, userId: tenantId }, query));
    assert.notDeepEqual(key, administrativeAuditKey({ ...actor, tenantId: id }, query));
    assert.notDeepEqual(key, administrativeAuditKey(platform, query, tenantId));
    assert.notDeepEqual(
      administrativeAuditKey(platform, query),
      administrativeAuditKey(platform, query, tenantId),
    );
    for (const patch of [
      { page: 2 },
      { pageSize: 10 },
      { outcome: "FAILURE" as const },
      { action: "template.ready" },
      { acceptedTo: "2026-10-21T00:00:00.000Z" },
    ])
      assert.notDeepEqual(key, administrativeAuditKey(actor, { ...query, ...patch }));
  });
  it("keeps deletion disabled and validates platform-only provisional policy metadata", () => {
    assert.deepEqual(mapAuditRetention(policy), policy);
    assert.throws(() => mapAuditRetention({ ...policy, deletionEnabled: true }));
    assert.throws(() => auditRetentionRequest(actor, 365));
    for (const days of [0, 1.5, 2147483648])
      assert.throws(() => auditRetentionRequest(platform, days));
    assert.deepEqual(auditRetentionRequest(platform, 180), { retentionDays: 180 });
  });
});

describe("administrative audit human HTTP", () => {
  it("sends action, machine actor and resource filters on the named-tenant route", async () => {
    let requested = "";
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "token",
      fetchImpl: async (url) => {
        requested = String(url);
        return new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }));
      },
    });
    await api.listAdministrativeAudit(
      platform,
      { ...query, action: "sms-pilot-grant.arm", actorCredentialId: id, resourceId: tenantId },
      tenantId,
    );
    const url = new URL(requested);
    assert.equal(url.pathname, `/api/v1/tenants/${tenantId}/audit-events`);
    assert.equal(url.searchParams.get("action"), "sms-pilot-grant.arm");
    assert.equal(url.searchParams.get("actorCredentialId"), id);
    assert.equal(url.searchParams.get("resourceId"), tenantId);
  });
  it("uses tenant, platform and named-tenant reads with Bearer authentication", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "human-token",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify(
            String(url).includes(`/${id}`)
              ? event
              : { items: [event], page: 1, pageSize: 20, total: 1 },
          ),
        );
      },
    });
    await api.listAdministrativeAudit(actor, query);
    await api.listAdministrativeAudit(platform, query);
    await api.listAdministrativeAudit(platform, query, tenantId);
    await api.getAdministrativeAudit(platform, id, tenantId);
    assert.deepEqual(
      calls.map((c) => new URL(c.url).pathname),
      [
        "/api/v1/audit-events",
        "/api/v1/platform/audit-events",
        `/api/v1/tenants/${tenantId}/audit-events`,
        `/api/v1/tenants/${tenantId}/audit-events/${id}`,
      ],
    );
    for (const call of calls) {
      assert.equal(call.init?.method, "GET");
      assert.equal(
        (call.init?.headers as Record<string, string>)["Authorization"],
        "Bearer human-token",
      );
    }
  });
  it("updates only retention metadata via PATCH and never calls delete", async () => {
    const calls: RequestInit[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "token",
      fetchImpl: async (_url, init) => {
        calls.push(init!);
        return new Response(JSON.stringify(policy));
      },
    });
    await api.getAuditRetention(platform);
    await api.updateAuditRetention(platform, 180);
    assert.deepEqual(
      calls.map((c) => c.method),
      ["GET", "PATCH"],
    );
    assert.deepEqual(JSON.parse(calls[1]!.body as string), { retentionDays: 180 });
    await assert.rejects(() => api.updateAuditRetention(actor, 180));
    assert.equal(calls.length, 2);
  });
  it("propagates live errors and malformed responses without mock fallback", async () => {
    for (const status of [401, 403, 404, 500]) {
      const api = createLiveApi({
        apiBaseUrl: "https://engine.example/api/v1",
        getAccessToken: () => "token",
        fetchImpl: async () => new Response("{}", { status }),
      });
      await assert.rejects(
        () => api.listAdministrativeAudit(actor, query),
        (error: unknown) => error instanceof ApiError && error.statusCode === status,
      );
    }
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => new Response("{}"),
    });
    await assert.rejects(() => api.listAdministrativeAudit(actor, query));
  });
});
