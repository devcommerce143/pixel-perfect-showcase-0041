import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  registryPath,
  registryQueryString,
  mapRegistryTemplate,
  mapRegistryPage,
  registerTemplateRequest,
  evidenceRequest,
} from "./template-registry-mapper.ts";
import {
  registryScopeKey,
  registryListKey,
  registryDetailKey,
  registryFailureKey,
  REGISTRY_STATUSES,
  TEMPLATE_APPROVAL_STATUSES,
} from "../template-registry.ts";
import { roleHas } from "../../auth/permissions.ts";

const tenantId = "11111111-1111-4111-8111-111111111111";
const otherTenant = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const actor = { role: "client_admin", tenantId, userId: id, name: "Admin" } as const;
const platform = { ...actor, role: "super_admin", tenantId: null } as const;
const row = {
  id,
  tenantId,
  channel: "WHATSAPP",
  templateKey: "order_update",
  language: "en_US",
  registryStatus: "DRAFT",
  providerApprovalStatus: "UNKNOWN",
  evidenceSource: null,
  providerTemplateId: null,
  approvalObservedAt: null,
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
};

describe("template registry contracts", () => {
  it("maps statuses separately without fabricating content, versions or approval", () => {
    for (const registryStatus of REGISTRY_STATUSES)
      assert.equal(
        mapRegistryTemplate({ ...row, registryStatus }, actor).registryStatus,
        registryStatus,
      );
    for (const providerApprovalStatus of TEMPLATE_APPROVAL_STATUSES)
      assert.equal(
        mapRegistryTemplate({ ...row, providerApprovalStatus }, actor).providerApprovalStatus,
        providerApprovalStatus,
      );
    const mapped = mapRegistryTemplate(
      { ...row, body: "secret", approvedContentHash: "secret", version: 8 },
      actor,
    );
    for (const key of ["body", "approvedContentHash", "version"])
      assert.equal(key in mapped, false);
    assert.equal(mapped.providerApprovalStatus, "UNKNOWN");
    assert.equal(
      mapRegistryTemplate({ ...row, evidenceSource: "PROVIDER_SYNC" }, platform, tenantId)
        .evidenceSource,
      "PROVIDER_SYNC",
    );
  });
  it("fails closed on cross-tenant/object responses and malformed enum/metadata values", () => {
    for (const patch of [
      { tenantId: otherTenant },
      { channel: "SMS" },
      { registryStatus: "ACTIVE" },
      { evidenceSource: "MADE_UP" },
      { providerApprovalStatus: "READY" },
      { createdAt: "invalid" },
    ])
      assert.throws(() => mapRegistryTemplate({ ...row, ...patch }, actor));
    assert.throws(() => mapRegistryTemplate(row, actor, undefined, otherTenant));
    assert.throws(() => mapRegistryPage({ items: [], page: 1, pageSize: 101, total: 0 }, actor));
  });
  it("requires explicit named-tenant platform context and validates only supported filters", () => {
    assert.equal(registryPath(actor), "/templates");
    assert.equal(registryPath(platform, tenantId), `/tenants/${tenantId}/templates`);
    assert.throws(() => registryPath(platform));
    assert.throws(() => registryPath(actor, otherTenant));
    const filters = new URLSearchParams(
      registryQueryString({
        page: 2,
        pageSize: 20,
        registryStatus: "READY",
        providerApprovalStatus: "APPROVED",
      }),
    );
    assert.equal(filters.get("registryStatus"), "READY");
    assert.equal(filters.get("providerApprovalStatus"), "APPROVED");
    for (const invalid of [
      { page: 0, pageSize: 20 },
      { page: 1, pageSize: 101 },
    ])
      assert.throws(() => registryQueryString(invalid));
  });
  it("validates registration fields and sends no unsupported content", () => {
    assert.deepEqual(registerTemplateRequest({ templateKey: " order_update ", language: " ar " }), {
      channel: "WHATSAPP",
      templateKey: "order_update",
      language: "ar",
    });
    for (const input of [
      { templateKey: "UpperCase", language: "en" },
      { templateKey: "x".repeat(65), language: "en" },
      { templateKey: "ok", language: "en-us" },
    ])
      assert.throws(() => registerTemplateRequest(input));
  });
  it("cannot elevate operator observations to trusted provider evidence", () => {
    const input = {
      providerApprovalStatus: "APPROVED",
      providerTemplateId: "template-1",
      approvalObservedAt: row.createdAt,
    } as const;
    assert.throws(() => evidenceRequest(actor, input));
    assert.deepEqual(evidenceRequest(platform, input, new Date("2026-10-21T00:00:00Z")), input);
    assert.throws(() => evidenceRequest(platform, { providerApprovalStatus: "APPROVED" }));
    assert.throws(() => evidenceRequest(platform, input, new Date("2026-10-19T00:00:00Z")));
    assert.deepEqual(evidenceRequest(platform, { ...input, providerApprovalStatus: "REJECTED" }), {
      providerApprovalStatus: "REJECTED",
    });
  });
  it("isolates caches by actor, selected/authenticated tenant, filters, pagination and object", () => {
    const query = { page: 1, pageSize: 20 };
    assert.notDeepEqual(
      registryScopeKey(actor),
      registryScopeKey({ ...actor, userId: otherTenant }),
    );
    assert.notDeepEqual(
      registryScopeKey(actor),
      registryScopeKey({ ...actor, tenantId: otherTenant }),
    );
    assert.notDeepEqual(
      registryScopeKey(platform, tenantId),
      registryScopeKey(platform, otherTenant),
    );
    assert.notDeepEqual(
      registryListKey(actor, query),
      registryListKey(actor, { ...query, page: 2 }),
    );
    assert.notDeepEqual(
      registryListKey(actor, query),
      registryListKey(actor, { ...query, registryStatus: "RETIRED" }),
    );
    assert.notDeepEqual(registryDetailKey(actor, id), registryDetailKey(actor, otherTenant));
  });
  it("keeps management permissions restricted and mock controls outside the live screen", () => {
    for (const role of ["viewer", "operator"] as const) {
      assert.equal(roleHas(role, "templates.manage"), false);
      assert.equal(roleHas(role, "platform.templates.manage"), false);
    }
    assert.equal(roleHas("client_admin", "templates.manage"), true);
    assert.equal(roleHas("super_admin", "platform.templates.manage"), true);
    const ui = readFileSync(
      new URL("../../../components/app/TemplateRegistry.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      ui,
      /submitTemplateForApproval|versionHistory|createBulkJob|sendMessage|MockTemplates/,
    );
    const route = readFileSync(new URL("../../../routes/templates.tsx", import.meta.url), "utf8");
    assert.match(route, /apiMode === "mock"/);
  });
});

describe("live registry API", () => {
  it("uses human Bearer endpoints for list/detail/register/ready/retire/evidence", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "token",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify(
            String(url).includes("?") ? { items: [row], page: 1, pageSize: 20, total: 1 } : row,
          ),
          { status: 200 },
        );
      },
    });
    const result = await api.listTemplateRegistry(actor, { page: 1, pageSize: 20 });
    assert.equal(result.total, 1);
    await api.getTemplateRegistry(platform, id, tenantId);
    await api.registerTemplate(actor, { templateKey: "order_update", language: "en" });
    await api.changeTemplateRegistry(actor, id, "ready");
    await api.changeTemplateRegistry(platform, id, "retire", tenantId);
    await api.recordTemplateEvidence(platform, id, { providerApprovalStatus: "PENDING" }, tenantId);
    assert.deepEqual(
      calls.map((c) => [new URL(c.url).pathname, c.init?.method]),
      [
        ["/api/v1/templates", "GET"],
        [`/api/v1/tenants/${tenantId}/templates/${id}`, "GET"],
        ["/api/v1/templates", "POST"],
        [`/api/v1/templates/${id}/ready`, "POST"],
        [`/api/v1/tenants/${tenantId}/templates/${id}/retire`, "POST"],
        [`/api/v1/tenants/${tenantId}/templates/${id}/evidence`, "POST"],
      ],
    );
    assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), {
      channel: "WHATSAPP",
      templateKey: "order_update",
      language: "en",
    });
    assert.deepEqual(JSON.parse(String(calls[5]?.init?.body)), {
      providerApprovalStatus: "PENDING",
    });
    for (const call of calls)
      assert.equal((call.init?.headers as Record<string, string>)["Authorization"], "Bearer token");
  });
  it("surfaces server failures and localized actionable categories without fake success", async () => {
    for (const [status, key] of [
      [400, "validation"],
      [403, "forbidden"],
      [404, "notFound"],
      [409, "conflict"],
      [500, "request"],
    ] as const) {
      const api = createLiveApi({
        apiBaseUrl: "https://engine.example/api/v1",
        getAccessToken: () => "token",
        fetchImpl: async () => new Response("{}", { status }),
      });
      for (const call of [
        () => api.listTemplateRegistry(actor, { page: 1, pageSize: 20 }),
        () => api.registerTemplate(actor, { templateKey: "key", language: "en" }),
        () => api.changeTemplateRegistry(actor, id, "ready"),
      ])
        await assert.rejects(
          call,
          (error: unknown) =>
            error instanceof ApiError && registryFailureKey(error) === `registry.error.${key}`,
        );
    }
  });
  it("rejects missing scope and tenant evidence requests before network access", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: "https://engine.example/api/v1",
      getAccessToken: () => "token",
      fetchImpl: async () => {
        calls++;
        throw new Error("Unexpected");
      },
    });
    await assert.rejects(() => api.listTemplateRegistry(platform, { page: 1, pageSize: 20 }));
    await assert.rejects(() =>
      api.recordTemplateEvidence(actor, id, { providerApprovalStatus: "UNKNOWN" }),
    );
    assert.equal(calls, 0);
  });
});
