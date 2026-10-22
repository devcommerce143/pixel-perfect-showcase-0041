import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  applicationMutationRequest,
  mapMutatedApplication,
} from "./application-mutation-mapper.ts";
import { applicationMutationFailureKey } from "../application-mutations.ts";
import type { LiveApplicationMutation } from "../application-mutations.ts";
import {
  applicationPageQueryKey,
  applicationDetailQueryKey,
  allTenantApplicationPageQueryKey,
} from "../application-query-keys.ts";
import { roleHas } from "../../auth/permissions.ts";
import { applicationListPath, platformApplicationListPath } from "./application-mapper.ts";
const tenantId = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333";
const actor = { role: "client_admin", tenantId, userId: id, name: "Admin" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
const row = {
  id,
  tenantId,
  name: "Billing API",
  environment: "PRODUCTION",
  status: "ACTIVE",
  channels: ["SMS"],
  scopes: ["MESSAGES_SEND"],
  senderAccess: "ALLOW_LIST",
  allowListSenderIds: [],
  channelAvailability: [{ channel: "SMS", granted: true, available: true }],
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
};
const operations: Array<{
  operation: LiveApplicationMutation;
  method: string;
  suffix: string;
  body: unknown;
}> = [
  {
    operation: {
      kind: "create",
      input: {
        name: " Billing API ",
        environment: "sandbox",
        status: "disabled",
        channels: ["sms"],
        scopes: ["messages:send"],
        senderAccess: "allow_list",
        allowListSenderIds: [],
      },
    },
    method: "post",
    suffix: "",
    body: {
      name: "Billing API",
      environment: "SANDBOX",
      status: "DISABLED",
      channels: ["SMS"],
      scopes: ["MESSAGES_SEND"],
      senderAccess: "ALLOW_LIST",
      allowListSenderIds: [],
    },
  },
  {
    operation: { kind: "name", id, name: " New name " },
    method: "patch",
    suffix: `/${id}`,
    body: { name: "New name" },
  },
  {
    operation: { kind: "status", id, status: "disabled" },
    method: "post",
    suffix: `/${id}/status`,
    body: { status: "DISABLED" },
  },
  {
    operation: { kind: "channels", id, channels: [] },
    method: "put",
    suffix: `/${id}/channels`,
    body: { channels: [] },
  },
  {
    operation: { kind: "scopes", id, scopes: [] },
    method: "put",
    suffix: `/${id}/scopes`,
    body: { scopes: [] },
  },
  {
    operation: { kind: "sender-access", id, senderAccess: "allow_list", allowListSenderIds: [] },
    method: "put",
    suffix: `/${id}/sender-access`,
    body: { senderAccess: "ALLOW_LIST", allowListSenderIds: [] },
  },
];
describe("live application mutation contracts", () => {
  it("builds scoped database filters and rejects unsupported sort fields and overflow", () => {
    const query = {
      search: " Billing ",
      filters: { status: "disabled" as const },
      sortBy: "createdAt" as const,
      sortDirection: "desc" as const,
    };
    const path = applicationListPath(actor.role, 1, 20, undefined, query);
    const params = new URL(`http://fixture${path}`).searchParams;
    assert.equal(params.get("search"), "Billing");
    assert.equal(params.get("status"), "DISABLED");
    assert.equal(params.get("sortBy"), "createdAt");
    assert.equal(params.get("sortDirection"), "desc");
    assert.ok(platformApplicationListPath(1, 20, query).startsWith("/platform/applications?"));
    assert.throws(() =>
      applicationListPath(actor.role, 1, 20, undefined, { sortBy: "lastActivityAt" }),
    );
    assert.throws(() => applicationListPath(actor.role, 1e12, 20));
  });
  for (const { operation, method, suffix, body } of operations)
    it(`maps ${operation.kind} to its exact transaction endpoint and allowlisted body`, () => {
      assert.deepEqual(applicationMutationRequest(actor, operation), {
        method,
        path: `/applications${suffix}`,
        body,
      });
      assert.deepEqual(applicationMutationRequest(platform, operation, tenantId), {
        method,
        path: `/tenants/${tenantId}/applications${suffix}`,
        body,
      });
    });
  it("rejects tenant hopping, implicit platform scope, invalid enums, duplicate grants and invalid sender policy", () => {
    const operation = operations[0]!.operation;
    assert.throws(() => applicationMutationRequest(platform, operation));
    assert.throws(() => applicationMutationRequest(actor, operation, other));
    for (const value of [
      { kind: "name", id, name: " " },
      { kind: "channels", id, channels: ["sms", "sms"] },
      { kind: "scopes", id, scopes: ["private"] },
      { kind: "sender-access", id, senderAccess: "all_eligible", allowListSenderIds: [other] },
      { kind: "sender-access", id, senderAccess: "allow_list", allowListSenderIds: ["private"] },
    ])
      assert.throws(() => applicationMutationRequest(actor, value as LiveApplicationMutation));
  });
  it("projects actual responses and rejects a different tenant or application", () => {
    const operation: LiveApplicationMutation = { kind: "name", id, name: "New" };
    assert.equal(
      mapMutatedApplication(
        { ...row, secret: "private", creatorName: "invented" },
        actor,
        operation,
      ).id,
      id,
    );
    assert.equal(
      "secret" in mapMutatedApplication({ ...row, secret: "private" }, actor, operation),
      false,
    );
    assert.throws(() => mapMutatedApplication({ ...row, tenantId: other }, actor, operation));
    assert.throws(() => mapMutatedApplication({ ...row, id: other }, actor, operation));
  });
  it("isolates read caches by authenticated identity as well as application and tenant context", () => {
    const another = { ...actor, userId: other },
      query = { page: 1, pageSize: 20 };
    assert.notDeepEqual(
      applicationPageQueryKey(actor, query),
      applicationPageQueryKey(another, query),
    );
    assert.notDeepEqual(
      applicationDetailQueryKey(actor, id),
      applicationDetailQueryKey(another, id),
    );
    assert.notDeepEqual(
      allTenantApplicationPageQueryKey(platform, query),
      allTenantApplicationPageQueryKey({ ...platform, userId: other }, query),
    );
  });
  it("limits presentation controls to administrators and isolates legacy mock forms", () => {
    assert.equal(roleHas("client_admin", "apps.manage"), true);
    assert.equal(roleHas("super_admin", "apps.manage"), true);
    assert.equal(roleHas("viewer", "apps.manage"), false);
    assert.equal(roleHas("operator", "apps.manage"), false);
    const ui = readFileSync(
      new URL("../../../components/app/LiveApplicationActions.tsx", import.meta.url),
      "utf8",
    );
    const route = readFileSync(
      new URL("../../../routes/applications.tsx", import.meta.url),
      "utf8",
    );
    assert.match(ui, /can\("apps.manage"\)/);
    assert.match(ui, /retry: false/);
    assert.doesNotMatch(ui, /api\./);
    assert.match(route, /LiveApplicationActions/);
    assert.match(route, /!isLive && <Sheet/);
    assert.doesNotMatch(route, /t\("apps.liveReadOnly"\)/);
  });
});
describe("live application human mutations", () => {
  it("uses Bearer-authenticated requests without combining independent configuration writes", async () => {
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    const api = createLiveApi({
      apiBaseUrl: "http://localhost:3000",
      getAccessToken: () => "human-token",
      fetchImpl: async (input, init) => {
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer human-token");
        requests.push({
          url: String(input),
          method: init?.method ?? "",
          body: JSON.parse(String(init?.body)) as unknown,
        });
        return new Response(JSON.stringify(row), { status: 200 });
      },
    });
    for (const { operation } of operations)
      await api.applyLiveApplicationMutation(platform, operation, tenantId);
    assert.equal(requests.length, operations.length);
    operations.forEach(({ method, suffix, body }, index) => {
      assert.equal(requests[index]!.method, method.toUpperCase());
      assert.ok(requests[index]!.url.endsWith(`/tenants/${tenantId}/applications${suffix}`));
      assert.deepEqual(requests[index]!.body, body);
    });
  });
  it("propagates failures with one request and no simulated success or mock fallback", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: "http://localhost:3000",
      getAccessToken: () => "human-token",
      fetchImpl: async () => {
        calls++;
        return new Response(JSON.stringify({ message: "Conflict" }), { status: 409 });
      },
    });
    await assert.rejects(
      api.applyLiveApplicationMutation(actor, { kind: "name", id, name: "New name" }),
      ApiError,
    );
    assert.equal(calls, 1);
    assert.equal(
      applicationMutationFailureKey(new ApiError({ statusCode: 409, message: "Conflict" })),
      "liveApplications.error.conflict",
    );
  });
});
