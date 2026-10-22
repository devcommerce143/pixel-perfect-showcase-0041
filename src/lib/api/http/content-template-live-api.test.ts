import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiveApi } from "./live-api.ts";
import { ApiError } from "./errors.ts";
import {
  contentTemplatePath,
  contentTemplateKey,
  contentTemplateQuery,
  contentTemplateMutation,
  contentTemplateRenderBody,
  mapContentTemplate,
  mapContentTemplateDetail,
  mapContentTemplatePage,
} from "../content-template.ts";
const tenant = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  actorId = "33333333-3333-4333-8333-333333333333";
const actor = { userId: actorId, tenantId: tenant, role: "client_admin", name: "Fixture" } as const;
const row = {
  id,
  tenantId: tenant,
  channel: "SMS",
  templateKey: "welcome",
  language: "en",
  version: 1,
  registryStatus: "DRAFT",
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
};
const detail = { ...row, body: "Private {{name}}", subject: null, parameters: ["name"] };
describe("reusable content versions, live API without provider calls", () => {
  it("requires named platform scope and prevents tenant target spoofing", () => {
    assert.equal(contentTemplatePath(actor), "/content-templates");
    assert.equal(
      contentTemplatePath({ ...actor, role: "super_admin", tenantId: null }, tenant, id),
      `/tenants/${tenant}/content-templates/${id}`,
    );
    assert.throws(() => contentTemplatePath({ ...actor, role: "super_admin", tenantId: null }));
    assert.throws(() => contentTemplatePath(actor, id));
  });
  it("isolates all scope/filter/page inputs without rendered parameter values in keys", () => {
    const key = contentTemplateKey(actor, tenant, { page: 1, pageSize: 20, channel: "sms" });
    assert.notDeepEqual(
      key,
      contentTemplateKey({ ...actor, userId: id }, tenant, {
        page: 1,
        pageSize: 20,
        channel: "sms",
      }),
    );
    assert.notDeepEqual(
      key,
      contentTemplateKey(actor, tenant, { page: 2, pageSize: 20, channel: "sms" }),
    );
    assert.notDeepEqual(
      key,
      contentTemplateKey(actor, id, { page: 1, pageSize: 20, channel: "sms" }),
    );
    assert.doesNotMatch(JSON.stringify(key), /Private|name/);
  });
  it("validates pagination and encodes explicit filters", () => {
    assert.throws(() =>
      mapContentTemplatePage({ items: [row], total: 1, page: 1, pageSize: 20 }, tenant, {
        page: 1,
        pageSize: 20,
        channel: "email",
      }),
    );
    assert.equal(
      contentTemplateQuery({
        page: 2,
        pageSize: 10,
        channel: "email",
        registryStatus: "ready",
        templateKey: "notice",
      }),
      "?page=2&pageSize=10&channel=EMAIL&registryStatus=READY&templateKey=notice",
    );
    assert.throws(() => contentTemplateQuery({ page: 0, pageSize: 20 }));
    assert.throws(() => contentTemplateQuery({ page: 1, pageSize: 101 }));
  });
  it("allowlists metadata and rejects cross-tenant detail or invented approval status", () => {
    const metadata = mapContentTemplate({ ...detail, createdByUserId: actorId }, tenant);
    assert.equal(metadata.channel, "sms");
    assert.equal(metadata.registryStatus, "draft");
    assert.equal(Object.hasOwn(metadata, "body"), false);
    assert.equal(Object.hasOwn(metadata, "createdByUserId"), false);
    assert.equal(mapContentTemplateDetail(detail, tenant, id).body, detail.body);
    assert.throws(() => mapContentTemplateDetail(detail, id, id));
    assert.throws(() => mapContentTemplateDetail(detail, tenant, actorId));
    assert.throws(() => mapContentTemplate({ ...row, registryStatus: "APPROVED" }, tenant));
    assert.throws(() =>
      mapContentTemplateDetail({ ...detail, parameters: ["name", "name"] }, tenant),
    );
  });
  it("separates read-only viewer access from content mutation permission", () => {
    assert.equal(contentTemplatePath({ ...actor, role: "viewer" }), "/content-templates");
    assert.throws(() =>
      contentTemplateMutation({ ...actor, role: "viewer" }, { kind: "ready", id }),
    );
    assert.throws(() =>
      contentTemplateMutation({ ...actor, role: "operator" }, { kind: "retire", id }),
    );
    assert.equal(
      contentTemplateMutation(actor, { kind: "ready", id }).path,
      `/content-templates/${id}/ready`,
    );
  });
  it("sends actual paginated reads and human-authenticated version creation", async () => {
    const requests: { url: string; init: RequestInit | undefined }[] = [];
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.example/api/v1",
      getAccessToken: () => "fixture-human",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(
          JSON.stringify(
            init?.method === "GET" ? { items: [row], total: 1, page: 1, pageSize: 20 } : detail,
          ),
          { status: init?.method === "GET" ? 200 : 201 },
        );
      },
    });
    const result = await api.listContentTemplates(actor, { page: 1, pageSize: 20 });
    assert.equal(result.items[0]?.version, 1);
    await api.applyContentTemplateMutation(actor, {
      kind: "create",
      input: { channel: "sms", templateKey: "welcome", language: "en", body: detail.body },
    });
    assert.equal(
      requests[0]?.url,
      "https://fixture.example/api/v1/content-templates?page=1&pageSize=20",
    );
    assert.equal(
      new Headers(requests[1]?.init?.headers).get("Authorization"),
      "Bearer fixture-human",
    );
    assert.deepEqual(JSON.parse(requests[1]?.init?.body as string), {
      channel: "SMS",
      templateKey: "welcome",
      language: "en",
      body: detail.body,
    });
  });
  it("renders with exact named values and projects only the expected content receipt", async () => {
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.example/api/v1",
      getAccessToken: () => "fixture-human",
      fetchImpl: async (url, init) => {
        assert.equal(String(url), `https://fixture.example/api/v1/content-templates/${id}/render`);
        assert.deepEqual(JSON.parse(init?.body as string), { parameters: { name: "أحمد" } });
        return new Response(
          JSON.stringify({
            templateId: id,
            version: 1,
            channel: "SMS",
            body: "Private أحمد",
            credential: "redacted",
          }),
          { status: 200 },
        );
      },
    });
    assert.deepEqual(await api.renderContentTemplate(actor, id, { name: "أحمد" }), {
      templateId: id,
      version: 1,
      channel: "sms",
      body: "Private أحمد",
    });
    assert.throws(() => contentTemplateRenderBody({ name: "x".repeat(1001) }));
  });
  it("preserves API errors without mock fallback or automatic retry", async () => {
    let calls = 0;
    const api = createLiveApi({
      apiBaseUrl: "https://fixture.example/api/v1",
      getAccessToken: () => "fixture-human",
      fetchImpl: async () => {
        calls++;
        return new Response("{}", { status: 503 });
      },
    });
    await assert.rejects(
      api.listContentTemplates(actor, { page: 1, pageSize: 20 }),
      (error) => error instanceof ApiError && error.statusCode === 503,
    );
    assert.equal(calls, 1);
  });
});
