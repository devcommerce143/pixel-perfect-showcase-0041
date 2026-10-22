import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  providerRoutesPath,
  providerRouteMutationRequest,
  mapProviderRoute,
  mapProviderRoutePage,
  mapTenantRouteAssignment,
  mapSenderRouteAssignment,
} from "./provider-route-mapper.ts";
import { providerRouteKey } from "../provider-routes.ts";
import type { ProviderRouteOperation } from "../provider-routes.ts";
import { roleHas } from "../../auth/permissions.ts";
const id = "11111111-1111-4111-8111-111111111111",
  account = "22222222-2222-4222-8222-222222222222",
  memberId = "33333333-3333-4333-8333-333333333333",
  tenant = "44444444-4444-4444-8444-444444444444",
  sender = "55555555-5555-4555-8555-555555555555";
const actor = { userId: account, role: "super_admin", tenantId: null, name: "Platform" } as const;
const member = {
  id: memberId,
  providerAccountId: account,
  providerCode: "sms-account",
  providerChannel: "SMS",
  providerStatus: "ACTIVE",
  priority: 1,
  enabled: true,
};
const route = { id, code: "sms-route", channel: "SMS", status: "ACTIVE", members: [member] };
const tenantAssignment = {
  id: memberId,
  tenantId: tenant,
  channel: "SMS",
  routeId: id,
  routeCode: "sms-route",
  routeStatus: "ACTIVE",
};
const senderAssignment = {
  id: memberId,
  tenantId: tenant,
  senderIdentityId: sender,
  routeId: id,
  routeCode: "sms-route",
  routeChannel: "SMS",
  routeStatus: "ACTIVE",
};
describe("provider route configuration and scoped assignments", () => {
  it("uses actual cursor filters and platform permissions", () => {
    assert.equal(
      providerRoutesPath(actor, { limit: 20, cursor: id, channel: "SMS", status: "DISABLED" }),
      `/provider-routes?limit=20&cursor=${id}&channel=SMS&status=DISABLED`,
    );
    for (const role of ["client_admin", "operator", "viewer"] as const) {
      assert.equal(roleHas(role, "platform.routing.manage"), false);
      assert.throws(() => providerRoutesPath({ ...actor, role, tenantId: tenant }, { limit: 20 }));
    }
    assert.equal(roleHas("super_admin", "platform.routing.manage"), true);
  });
  it("projects safe route/member metadata and rejects unknown status, duplicate priority and malformed bools", () => {
    assert.deepEqual(
      mapProviderRoute(
        { ...route, secret: "private", members: [{ ...member, credential: "private" }] },
        id,
      ),
      route,
    );
    for (const bad of [
      { ...route, status: "HEALTHY" },
      { ...route, members: [{ ...member, enabled: "false" }] },
      { ...route, members: [member, { ...member, id: sender, providerAccountId: sender }] },
      { ...route, members: [{ ...member, priority: 0 }] },
    ])
      assert.throws(() => mapProviderRoute(bad));
    assert.throws(() => mapProviderRoute(route, account));
  });
  it("validates cursor pages without fabricating totals or truncating", () => {
    assert.deepEqual(mapProviderRoutePage({ items: [route], nextCursor: null }, { limit: 20 }), {
      items: [route],
      nextCursor: null,
    });
    assert.throws(() => mapProviderRoutePage({ items: [route], nextCursor: id }, { limit: 20 }));
    assert.throws(() =>
      mapProviderRoutePage({ items: [route, route], nextCursor: null }, { limit: 20 }),
    );
  });
  it("enforces named tenant/sender scope on returned assignments", () => {
    assert.deepEqual(
      mapTenantRouteAssignment({ ...tenantAssignment, payload: "private" }, tenant, "SMS"),
      tenantAssignment,
    );
    assert.deepEqual(mapSenderRouteAssignment(senderAssignment, tenant, sender), senderAssignment);
    assert.throws(() => mapTenantRouteAssignment(tenantAssignment, account, "SMS"));
    assert.throws(() => mapTenantRouteAssignment(tenantAssignment, tenant, "EMAIL"));
    assert.throws(() => mapSenderRouteAssignment(senderAssignment, account, sender));
    assert.throws(() => mapSenderRouteAssignment(senderAssignment, tenant, account));
  });
  it("sends explicit JSON booleans and validates priorities and registration code", () => {
    assert.deepEqual(
      providerRouteMutationRequest(actor, {
        kind: "updateMember",
        routeId: id,
        memberId,
        priority: 2,
        enabled: false,
      }),
      { path: `/provider-routes/${id}/members/${memberId}`, body: { priority: 2, enabled: false } },
    );
    assert.throws(() =>
      providerRouteMutationRequest(actor, { kind: "create", code: "UPPER", channel: "SMS" }),
    );
    assert.throws(() =>
      providerRouteMutationRequest(actor, {
        kind: "addMember",
        routeId: id,
        providerAccountId: account,
        priority: 101,
        enabled: true,
      }),
    );
  });
  it("uses human reads for list/detail/default/override and returns null only for assignment 404", async () => {
    let response: unknown = { items: [route], nextCursor: null },
      status = 200;
    const paths: string[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async (url, init) => {
        assert.equal(init?.method, "GET");
        assert.equal((init?.headers as Record<string, string>)["Authorization"], "Bearer token");
        paths.push(String(url));
        return new Response(JSON.stringify(response), { status });
      },
    });
    await api.listProviderRoutes(actor, { limit: 20 });
    response = route;
    await api.getProviderRoute(actor, id);
    response = tenantAssignment;
    await api.getTenantRouteAssignment(actor, tenant, "SMS");
    response = senderAssignment;
    await api.getSenderRouteAssignment(actor, tenant, sender);
    assert.deepEqual(paths, [
      "https://api.example.com/v1/provider-routes?limit=20",
      `https://api.example.com/v1/provider-routes/${id}`,
      `https://api.example.com/v1/provider-route-assignments/tenants/${tenant}?channel=SMS`,
      `https://api.example.com/v1/provider-route-assignments/senders/${sender}`,
    ]);
    status = 404;
    assert.equal(await api.getTenantRouteAssignment(actor, tenant, "SMS"), null);
    assert.equal(await api.getSenderRouteAssignment(actor, tenant, sender), null);
    await assert.rejects(api.getProviderRoute(actor, id), ApiError);
    status = 403;
    await assert.rejects(api.getTenantRouteAssignment(actor, tenant, "SMS"), ApiError);
  });
  it("round-trips each configuration action against exact endpoints without a dispatch or probe request", async () => {
    const operations: ProviderRouteOperation[] = [
      { kind: "create", code: "sms-route", channel: "SMS" },
      { kind: "status", routeId: id, status: "DISABLED" },
      { kind: "addMember", routeId: id, providerAccountId: account, priority: 1, enabled: true },
      { kind: "updateMember", routeId: id, memberId, priority: 2, enabled: false },
      { kind: "assignTenant", tenantId: tenant, routeId: id, channel: "SMS" },
      { kind: "assignSender", tenantId: tenant, senderIdentityId: sender, routeId: id },
    ];
    let response: unknown;
    let calls = 0;
    for (const operation of operations) {
      const expected = providerRouteMutationRequest(actor, operation);
      response =
        operation.kind === "assignTenant"
          ? tenantAssignment
          : operation.kind === "assignSender"
            ? senderAssignment
            : operation.kind === "status"
              ? { ...route, status: "DISABLED" }
              : operation.kind === "updateMember"
                ? { ...route, members: [{ ...member, priority: 2, enabled: false }] }
                : route;
      const api = createLiveApi({
        apiBaseUrl: "https://api.example.com/v1",
        getAccessToken: () => "token",
        fetchImpl: async (url, init) => {
          calls++;
          assert.equal(String(url), `https://api.example.com/v1${expected.path}`);
          assert.equal(init?.method, "POST");
          assert.equal(init?.body, JSON.stringify(expected.body));
          return new Response(JSON.stringify(response));
        },
      });
      const result = await api.applyProviderRouteMutation(actor, operation);
      assert.equal(
        result.kind,
        operation.kind === "assignTenant"
          ? "tenant"
          : operation.kind === "assignSender"
            ? "sender"
            : "route",
      );
    }
    assert.equal(calls, operations.length);
  });
  it("propagates errors without fabricated persistence or mock fallback", async () => {
    const api = createLiveApi({
      apiBaseUrl: "https://api.example.com/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => new Response('{"message":"conflict"}', { status: 409 }),
    });
    await assert.rejects(
      api.applyProviderRouteMutation(actor, { kind: "status", routeId: id, status: "DISABLED" }),
      ApiError,
    );
  });
  it("isolates identity, selected tenant, resource, filters and cursor in query/state boundaries", () => {
    assert.notDeepEqual(providerRouteKey(actor), providerRouteKey({ ...actor, userId: id }));
    const source = readFileSync(new URL("../queries.ts", import.meta.url), "utf8");
    assert.match(source, /providerRouteKey\(actor\), "tenant", tenant, channel/);
    assert.match(source, /providerRouteKey\(actor\), "sender", tenant, sender/);
    assert.match(source, /providerRouteKey\(actor\), "list", query/);
    const wrapper = readFileSync(
      new URL("../../../routes/platform.routing.tsx", import.meta.url),
      "utf8",
    );
    assert.match(wrapper, /apiMode === "mock"/);
    assert.match(wrapper, /user\?\.id.*user\?\.role.*tenantId/);
    const ui = readFileSync(
      new URL("../../../components/app/ProviderRouting.tsx", import.meta.url),
      "utf8",
    );
    assert.match(ui, /retry: false/);
    assert.doesNotMatch(ui, /failoverTriggers|retryPolicy|testProviderConnection|api\./);
  });
});
